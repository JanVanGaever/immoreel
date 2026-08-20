import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { SEED_ORGANISATION_ID, SEED_USER_IDS, minutes, seedTime } from "@/db/seed/config";
import { seedBrandKit } from "@/db/seed/brand";
import { seedProjects } from "@/db/seed/projects";
import { toEditorDocument } from "@/lib/editor/document";
import { estimateFileSizeInBytes, findExportPreset } from "@/lib/editor/export-presets";
import { buildRenderPlan } from "@/lib/editor/render-plan";
import { messageFor } from "@/lib/render/errors";
import { buildOutputKey, buildRenderJobId, fingerprintRenderPlan } from "@/lib/render/fingerprint";
import { workDir } from "@/workers/config";
import type { ID, RenderJob, VideoProject } from "@/types";

/**
 * Drie renderjobs: twee geslaagde en een mislukte.
 *
 * De ids zijn niet verzonnen. Ze worden hier op exact dezelfde manier berekend
 * als wanneer je in de editor op "Export starten" duwt: het renderplan wordt
 * opgebouwd uit het project en de huisstijl, daarvan komt een vingerafdruk, en
 * die bepaalt de id (`src/lib/render/fingerprint.ts`).
 *
 * Dat is meer dan netheid. Wie op de geseede Leiestraat-video opnieuw
 * exporteert naar dezelfde platformen, krijgt dezelfde job-id terug — en dus
 * "deze render bestaat al" in plaats van een tweede render van hetzelfde. De
 * idempotentie is daarmee niet alleen geseed, ze is te demonstreren.
 *
 * Wat er níét bij zit is een posterbeeld: dat is een still uit een video die
 * nooit gerenderd is. De kaart op de downloadpagina valt dan terug op haar
 * kleurvlak, precies zoals bedoeld voor renders zonder still.
 */

type SeedJobInput = {
  project: VideoProject;
  presetId: ID;
  /** Minuten geleden dat de job in de wachtrij kwam. */
  queuedMinutesAgo: number;
  /** Hoe lang de render duurde, in minuten. */
  runMinutes: number;
};

/**
 * De basis van een job: alles wat uit het project en de preset volgt. Wat er
 * daarna nog bij komt — geslaagd of mislukt — verschilt per geval.
 */
function buildJob(input: SeedJobInput) {
  const preset = findExportPreset(input.presetId);

  if (!preset) {
    throw new Error(`Seed: exportpreset ${input.presetId} bestaat niet meer in de catalogus.`);
  }

  const plan = buildRenderPlan(toEditorDocument(input.project, seedBrandKit()), preset);
  const fingerprint = fingerprintRenderPlan(plan);
  const jobId = buildRenderJobId({
    projectId: input.project.id,
    presetId: preset.id,
    fingerprint,
  });

  const queuedAt = seedTime(-minutes(input.queuedMinutesAgo));
  const startedAt = seedTime(-minutes(input.queuedMinutesAgo - 1));
  const finishedAt = seedTime(-minutes(input.queuedMinutesAgo - 1 - input.runMinutes));

  return {
    preset,
    plan,
    base: {
      id: jobId,
      organisationId: SEED_ORGANISATION_ID,
      projectId: input.project.id,
      presetId: preset.id,
      requestedByUser: SEED_USER_IDS.editor,
      fingerprint,
      queuedAt,
      startedAt,
      finishedAt,
    },
  };
}

/**
 * Waar het bestand van een afgewerkte render staat.
 *
 * Dezelfde sleutel als de worker gebruikt, en lokaal dus een `file://`-URL naar
 * `RENDER_WORK_DIR/published/`. `npm run seed` zet daar een bestand neer, zodat
 * de downloadknop ook echt bytes teruggeeft. Zonder dat bestand antwoordt de
 * downloadroute met 410 — de rij klopt dan wel, de opslag is alleen leeg.
 */
export function seedOutputUrl(outputKey: string): string {
  return pathToFileURL(join(resolve(workDir(), "published"), outputKey)).href;
}

export function seedRenderJobs(): RenderJob[] {
  const [belEtage, appartement, herenhuis] = seedProjects();

  if (!herenhuis || !appartement || !belEtage) {
    throw new Error("Seed: de projecten van de seed zijn niet compleet.");
  }

  const jobs: RenderJob[] = [];

  // Twee geslaagde renders van hetzelfde project: de downloadpagina toont dan
  // twee kaarten naast elkaar, wat de zip-download ook meteen zinvol maakt.
  for (const done of [
    { presetId: "website-16x9", queuedMinutesAgo: 305, runMinutes: 6 },
    { presetId: "linkedin-16x9", queuedMinutesAgo: 305, runMinutes: 13 },
  ]) {
    const { preset, plan, base } = buildJob({
      project: herenhuis,
      presetId: done.presetId,
      queuedMinutesAgo: done.queuedMinutesAgo,
      runMinutes: done.runMinutes,
    });

    const outputKey = buildOutputKey({
      organisationId: base.organisationId,
      projectId: base.projectId,
      jobId: base.id,
      container: preset.container,
    });

    jobs.push({
      id: base.id,
      organisationId: base.organisationId,
      projectId: base.projectId,
      presetId: base.presetId,
      requestedBy: base.requestedByUser,
      fingerprint: base.fingerprint,
      status: "done",
      stage: "publish",
      progress: 100,
      attempt: 1,
      // De lease valt vrij zodra de job af is; alleen een lopende render houdt er een vast.
      leaseId: null,
      outputKey,
      outputUrl: seedOutputUrl(outputKey),
      posterUrl: null,
      durationInSeconds: plan.durationInSeconds,
      sizeInBytes: estimateFileSizeInBytes(preset, plan.durationInSeconds),
      error: null,
      queuedAt: base.queuedAt,
      startedAt: base.startedAt,
      finishedAt: base.finishedAt,
      createdAt: base.queuedAt,
      updatedAt: base.finishedAt,
    });
  }

  // De mislukte: drie pogingen op een foto die de opslag niet teruggaf. De code
  // is `asset-download` en die is herkansbaar — dus staat er op de
  // downloadpagina een knop "Opnieuw proberen", en dat is het punt van dit geval.
  const failed = buildJob({
    project: appartement,
    presetId: "instagram-reels-9x16",
    queuedMinutesAgo: 550,
    runMinutes: 4,
  });

  jobs.push({
    id: failed.base.id,
    organisationId: failed.base.organisationId,
    projectId: failed.base.projectId,
    presetId: failed.base.presetId,
    requestedBy: failed.base.requestedByUser,
    fingerprint: failed.base.fingerprint,
    status: "failed",
    stage: "fetch",
    // De voortgang blijft staan waar ze strandde; ze loopt nooit terug.
    progress: 34,
    attempt: 3,
    leaseId: null,
    outputKey: null,
    outputUrl: null,
    posterUrl: null,
    durationInSeconds: null,
    sizeInBytes: null,
    error: {
      code: "asset-download",
      message: messageFor("asset-download"),
      detail: "GET foto's/IMG_2291.heic — 504 Gateway Timeout (poging 3 van 3)",
      stage: "fetch",
      retryable: true,
      at: failed.base.finishedAt,
    },
    queuedAt: failed.base.queuedAt,
    startedAt: failed.base.startedAt,
    finishedAt: failed.base.finishedAt,
    createdAt: failed.base.queuedAt,
    updatedAt: failed.base.finishedAt,
  });

  return jobs;
}

/** Hoeveel renderminuten er deze maand op de teller staan (dashboard). */
export function seedRenderMinutes(jobs: RenderJob[]): number {
  const seconds = jobs
    .filter((job) => job.status === "done")
    .reduce((total, job) => total + (job.durationInSeconds ?? 0), 0);

  return Math.round(seconds / 60);
}

