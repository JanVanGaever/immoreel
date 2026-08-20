import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getProjectStore } from "@/db/project-store";
import { toEditorDocument } from "@/lib/editor/document";
import { findExportPreset } from "@/lib/editor/export-presets";
import { buildRenderPlan, type RenderPlan } from "@/lib/editor/render-plan";
import { RenderError } from "@/lib/render/errors";
import { buildOutputKey, buildPosterKey, fingerprintRenderPlan } from "@/lib/render/fingerprint";
import { workDir } from "@/workers/config";
import type { Logger } from "@/workers/logger";
import { getRenderAssetSource } from "@/workers/render/assets";
import { getRenderBackend, type RenderBackend } from "@/workers/render/backend";
import { getRenderStorage, type RenderStorage } from "@/workers/render/storage";
import type { RenderJobData } from "@/workers/queue";
import type { ID, RenderStageId } from "@/types";

/**
 * De pijplijn: van een projectid naar een bestand in de opslag.
 *
 * De stappen staan hier los van de wachtrij en los van FFmpeg. De worker weet
 * daardoor niets van zoompan-filters, en deze module niets van pogingen,
 * leases of Redis. Wat ze wel doet is na elke stap melden hoe ver ze staat —
 * dat is wat de statussen `processing` en `finalizing` betekenis geeft.
 *
 * Elke stap kan opnieuw uitgevoerd worden zonder schade: de werkmap wordt
 * eerst leeggemaakt en de uitvoer krijgt altijd dezelfde sleutel.
 */

export type RenderReport = (stage: RenderStageId, fraction: number) => Promise<void>;

export type RenderPipelineInput = {
  data: RenderJobData;
  signal: AbortSignal;
  log: Logger;
  report: RenderReport;
};

export type RenderPipelineResult = {
  outputKey: string;
  outputUrl: string;
  posterUrl: string | null;
  durationInSeconds: number;
  sizeInBytes: number;
};

export async function runRenderPipeline(
  input: RenderPipelineInput,
): Promise<RenderPipelineResult> {
  const { data, signal, log, report } = input;
  const directory = resolve(workDir(), data.jobId);

  // Een vorige poging kan halve bestanden hebben achtergelaten. Schoon
  // beginnen is goedkoper dan uitzoeken wat er nog bruikbaar van is.
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });

  try {
    await report("prepare", 0);
    const plan = await buildPlan(data, log);
    await report("prepare", 1);

    const backend = getRenderBackend();
    log.debug("Backend gekozen", { backend: backend.name, scenes: plan.scenes.length });

    // De nepbackend raakt de foto's niet aan; ze ophalen zou een render van
    // niets laten mislukken op een map die nog niet bestaat.
    let assets: Record<ID, string> = {};

    if (backend.needsAssets) {
      assets = await fetchAssets(plan, { directory, signal, log, report });
    } else {
      // De stap overslaan mag, hem niet melden niet: de balk zou blijven hangen
      // op het gewicht van `fetch`.
      await report("fetch", 1);
    }

    const context = { plan, assets, workDir: directory, signal, log };

    const clips = await backend.renderScenes({
      ...context,
      onProgress: (fraction) => void report("scenes", fraction),
    });

    const outputPath = join(directory, `output.${plan.container}`);
    const output = await backend.stitch({
      ...context,
      clips,
      outputPath,
      onProgress: (fraction) => void report("stitch", fraction),
    });

    // Vanaf hier is het beeld klaar en loopt alleen het wegschrijven nog:
    // dit is de stap die de job op `finalizing` zet.
    await report("publish", 0);

    const key = buildOutputKey({
      organisationId: data.organisationId,
      projectId: data.projectId,
      jobId: data.jobId,
      container: plan.container,
    });

    const storage = getRenderStorage();
    const stored = await storage.put({
      key,
      path: output.path,
      contentType: `video/${plan.container}`,
    });

    await report("publish", 0.7);

    // Het posterbeeld komt uit de afgewerkte video, dus pas hier. Lukt het
    // niet, dan gaat de render gewoon door: de projectlijst valt terug op een
    // kader zonder beeld.
    const posterUrl = await publishPoster({
      backend,
      context: { ...context, videoPath: output.path, onProgress: () => undefined },
      directory,
      data,
      log,
      storage,
    });

    await report("publish", 1);

    return {
      outputKey: stored.key,
      outputUrl: stored.url,
      posterUrl,
      durationInSeconds: output.durationInSeconds,
      sizeInBytes: stored.sizeInBytes,
    };
  } finally {
    // Tussenbestanden van een render zijn zo groot als de video zelf; ze laten
    // staan vult binnen een dag de schijf van de worker.
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Het renderplan van dit moment.
 *
 * Het plan wordt hier opnieuw opgebouwd en niet uit de wachtrij gehaald: een
 * job kan minuten oud zijn, en wat er gerenderd moet worden staat in het
 * project, niet in een kopie ervan.
 */
async function buildPlan(data: RenderJobData, log: Logger): Promise<RenderPlan> {
  const project = await getProjectStore().findProject(data.organisationId, data.projectId);

  if (!project) {
    throw new RenderError("project-missing", {
      stage: "prepare",
      detail: `Project ${data.projectId} is niet gevonden.`,
    });
  }

  const preset = findExportPreset(data.presetId);

  if (!preset) {
    throw new RenderError("preset-missing", {
      stage: "prepare",
      detail: `Exportpreset ${data.presetId} bestaat niet meer.`,
    });
  }

  const plan = buildRenderPlan(toEditorDocument(project), preset);

  if (plan.missingAssets.length > 0) {
    throw new RenderError("assets-missing", {
      stage: "prepare",
      detail: `${plan.missingAssets.length} scène(s) hebben geen foto in de opslag.`,
    });
  }

  // Het project is bewerkt nadat de export gevraagd werd. We renderen wat er
  // nu staat — dat is wat de gebruiker bedoelt — maar het is het vermelden
  // waard, want de vingerafdruk van deze job hoort dan bij een ouder plan.
  const fingerprint = fingerprintRenderPlan(plan);
  if (fingerprint !== data.fingerprint) {
    log.warn("Het project is gewijzigd sinds de export gevraagd werd", {
      queuedFingerprint: data.fingerprint.slice(0, 12),
      currentFingerprint: fingerprint.slice(0, 12),
    });
  }

  return plan;
}

/**
 * De foto's naar de worker halen.
 *
 * Dat dit een eigen stap is, heeft een reden: een foto die niet opgehaald
 * raakt, is een fout die het opnieuw proberen waard is (`asset-download` is
 * `retryable`), terwijl een filter die FFmpeg weigert dat niet is. Bovendien
 * leest FFmpeg liever van schijf: een verbinding die halverwege een encodering
 * hapert, kost anders de hele clip.
 */
async function fetchAssets(
  plan: RenderPlan,
  context: {
    directory: string;
    signal: AbortSignal;
    log: Logger;
    report: RenderReport;
  },
): Promise<Record<ID, string>> {
  const source = getRenderAssetSource();
  const total = plan.scenes.length || 1;
  const assets: Record<ID, string> = {};

  context.log.debug("Foto's ophalen", { bron: source.name, aantal: plan.scenes.length });

  for (const [index, scene] of plan.scenes.entries()) {
    if (context.signal.aborted) {
      throw new RenderError("cancelled", { stage: "fetch" });
    }

    if (!scene.assetId) {
      throw new RenderError("assets-missing", {
        stage: "fetch",
        detail: `Scène ${scene.sceneId} heeft geen asset.`,
      });
    }

    // Op volgorde genummerd en niet op asset-id: zo is een werkmap tijdens een
    // vastgelopen render nog te lezen als een tijdlijn.
    assets[scene.sceneId] = await source.fetch({
      assetId: scene.assetId,
      destination: join(context.directory, `asset-${String(scene.order).padStart(3, "0")}`),
      signal: context.signal,
    });

    await context.report("fetch", (index + 1) / total);
  }

  return assets;
}

/**
 * Het posterbeeld: een still uit de video, naast de video zelf in de opslag.
 *
 * Een backend hoeft er geen te kunnen maken (de nepbackend kan het niet), en
 * mislukken mag: dit draait ná het wegschrijven van de video, en die is dan al
 * veilig.
 */
async function publishPoster(input: {
  backend: RenderBackend;
  context: Omit<Parameters<NonNullable<RenderBackend["poster"]>>[0], "outputPath">;
  directory: string;
  data: RenderJobData;
  log: Logger;
  storage: RenderStorage;
}): Promise<string | null> {
  const { backend, data } = input;

  if (!backend.poster) return null;

  const posterPath = await backend.poster({
    ...input.context,
    outputPath: join(input.directory, "poster.jpg"),
  });

  if (!posterPath) return null;

  try {
    const stored = await input.storage.put({
      key: buildPosterKey({
        organisationId: data.organisationId,
        projectId: data.projectId,
        jobId: data.jobId,
      }),
      path: posterPath,
      contentType: "image/jpeg",
    });

    return stored.url;
  } catch (error) {
    input.log.warn("Posterbeeld niet weggeschreven", { reden: String(error) });

    return null;
  }
}
