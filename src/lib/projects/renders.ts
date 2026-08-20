import { revalidatePath } from "next/cache";
import { getBrandKitStore } from "@/db/brand-kit-store";
import { getProjectStore } from "@/db/project-store";
import { conflict, invalidInput, unavailable } from "@/lib/api/errors";
import { ROUTES } from "@/lib/constants";
import type { ExportRequest } from "@/lib/editor/action-state";
import { toEditorDocument } from "@/lib/editor/document";
import { buildExportBatch, describeFormat } from "@/lib/editor/export-presets";
import { buildRenderPlan } from "@/lib/editor/render-plan";
import { loadOwnProject } from "@/lib/projects/service";
import { toRenderJobSnapshot } from "@/lib/render/status";
import { isQueueConfigured } from "@/workers/config";
import { ensureInlineRenderWorker } from "@/workers/inline";
import { enqueueRenderJob } from "@/workers/queue";
import type { ID, RenderJobSnapshot } from "@/types";

/**
 * Een export aanvragen: één plek voor de knop in de editor én voor de API.
 *
 * Er wordt hier niets gerenderd. De functie bouwt per gekozen platform een
 * renderplan, zet dat in de wachtrij en geeft terug welke jobs eruit kwamen.
 * De worker doet de rest, en de voortgang volg je op
 * `/api/projects/:projectId/renders`.
 *
 * Twee keer aanvragen levert geen twee renders op. De id van een job volgt uit
 * project, preset en renderplan (`src/lib/render/fingerprint.ts`), dus de
 * tweede opdracht is letterlijk dezelfde als de eerste. Dat maakt deze route
 * veilig om opnieuw te versturen — een client die niet weet of zijn verzoek
 * aankwam, mag het gewoon nog eens doen.
 */

export type StartRendersInput = {
  organisationId: ID;
  /** Wie erom vroeg; komt in de renderjob terecht. */
  requestedBy: ID;
  projectId: ID;
  presetIds: ID[];
};

export type StartRendersResult = {
  requests: ExportRequest[];
  jobs: RenderJobSnapshot[];
};

export async function startRenders(input: StartRendersInput): Promise<StartRendersResult> {
  if (input.presetIds.length === 0) {
    throw invalidInput("Kies minstens één platform om naar te exporteren.");
  }

  if (!isQueueConfigured()) {
    throw unavailable(
      "De renderwachtrij is niet geconfigureerd. Zet REDIS_URL en start de worker.",
    );
  }

  const project = await loadOwnProject(input.organisationId, input.projectId);

  // De huisstijl komt van de server en niet uit het tabblad: wat de editor
  // toonde kan intussen achterhaald zijn, en een render hoort de huisstijl te
  // krijgen die er nú staat.
  const brand = await getBrandKitStore().getBrandKit(input.organisationId);
  const document = toEditorDocument(project, brand);

  // Dezelfde doorrekening als in de editor, maar op wat er nú op de server
  // staat. De client mag hier niet het laatste woord hebben: een tabblad dat
  // een uur openstond, weet niet meer wat er intussen bewaard is.
  const batch = buildExportBatch(input.presetIds, {
    aspectRatio: project.aspectRatio,
    durationInSeconds: project.durationInSeconds,
    sceneCount: project.scenes.length,
    title: project.title,
  });

  // Blokkerend betekent: dit bestand zou het platform weigeren. Geen 400 — de
  // aanvraag is goed, de video past er alleen niet in.
  if (batch.blocking.length > 0) throw conflict(batch.blocking[0]!.message);

  if (batch.items.length === 0) {
    throw invalidInput("Geen van de gekozen platformen bestaat nog.");
  }

  const requests: ExportRequest[] = [];
  const jobs: RenderJobSnapshot[] = [];

  // Alleen bij ontwikkelen: dan draait de worker mee in dit proces.
  ensureInlineRenderWorker();

  for (const item of batch.items) {
    const { job, reason } = await enqueueRenderJob({
      organisationId: input.organisationId,
      projectId: input.projectId,
      presetId: item.preset.id,
      requestedBy: input.requestedBy,
      plan: buildRenderPlan(document, item.preset),
    });

    requests.push({
      jobId: job.id,
      presetId: item.preset.id,
      label: item.preset.label,
      format: describeFormat(item.preset),
      fileName: item.fileName,
      isNew: reason === "new" || reason === "retried",
    });

    jobs.push(toRenderJobSnapshot(job));
  }

  // De worker zet de status verder (`renderen`, `klaar`, `mislukt`); dit is
  // alleen wat er nu al klopt, zodat de lijst niet achterloopt tot de eerste
  // worker wakker wordt.
  await getProjectStore().setProjectStatus(input.organisationId, input.projectId, "wachtrij");

  revalidatePath(ROUTES.projects);
  revalidatePath(ROUTES.project(input.projectId));
  revalidatePath(ROUTES.projectExports(input.projectId));

  return { requests, jobs };
}
