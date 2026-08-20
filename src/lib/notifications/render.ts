import { getProjectStore } from "@/db/project-store";
import { findExportPreset } from "@/lib/editor/export-presets";
import { notify } from "@/lib/notifications/service";
import type { RenderJob } from "@/types";

/**
 * Van een afgewerkte renderjob naar een melding.
 *
 * Staat hier en niet in de worker, om twee redenen. De worker weet alles van
 * lease, wachtrij en pijplijn en niets van wie er iets over wil horen; en de
 * projectnaam en het exportformaat die in de zin horen, moeten opgezocht
 * worden — dat is werk voor de laag die de melding maakt, niet voor de laag die
 * rendert.
 *
 * Wordt alleen aangeroepen bij een eindstand. Een mislukking waar nog een
 * nieuwe poging op volgt, is geen nieuws: die lost zichzelf meestal op, en een
 * melding erover is een melding die de gebruiker leert wegklikken.
 */
export async function notifyRenderFinished(job: RenderJob): Promise<void> {
  const project = await getProjectStore().findProject(job.organisationId, job.projectId);
  const projectTitle = project?.title ?? "je project";
  const presetLabel = findExportPreset(job.presetId)?.label ?? "De export";

  if (job.status === "done") {
    await notify({
      topic: "render-klaar",
      organisationId: job.organisationId,
      userId: job.requestedBy,
      projectId: job.projectId,
      projectTitle,
      jobId: job.id,
      presetLabel,
    });

    return;
  }

  if (job.status !== "failed" || !job.error) return;

  await notify({
    topic: "render-mislukt",
    organisationId: job.organisationId,
    userId: job.requestedBy,
    projectId: job.projectId,
    projectTitle,
    jobId: job.id,
    presetLabel,
    reason: job.error.message,
    code: job.error.code,
    retryable: job.error.retryable,
  });
}
