"use server";

import { revalidatePath } from "next/cache";
import { getProjectStore } from "@/db/project-store";
import { getTemplateStore } from "@/db/template-store";
import { assertPermission } from "@/lib/auth/session";
import type { ExportRequest, ExportState, SaveState } from "@/lib/editor/action-state";
import { toEditorDocument, type ProjectPatch } from "@/lib/editor/document";
import { buildExportBatch, describeFormat } from "@/lib/editor/export-presets";
import { buildRenderPlan } from "@/lib/editor/render-plan";
import { hasErrors, sanitizePatch, validatePatch } from "@/lib/editor/validation";
import { ROUTES } from "@/lib/constants";
import { isQueueConfigured } from "@/workers/config";
import { enqueueRenderJob } from "@/workers/queue";
import { ensureInlineRenderWorker } from "@/workers/inline";
import type { ID } from "@/types";

/**
 * De serveracties van de editor.
 *
 * De editor bewaart automatisch, maar dat maakt de browser niet
 * betrouwbaarder: rol, eigenaarschap en validatie gaan hier opnieuw door de
 * molen, precies zoals bij de wizard.
 */

export async function saveProjectAction(projectId: ID, patch: ProjectPatch): Promise<SaveState> {
  const { organisation } = await assertPermission("project:edit");

  const templates = await getTemplateStore().listTemplates(organisation.id);
  const errors = validatePatch(patch, templates);

  if (hasErrors(errors)) {
    return {
      status: "fout",
      message: "Deze wijziging kon niet bewaard worden.",
      fieldErrors: errors,
    };
  }

  const project = await getProjectStore().updateProject(
    organisation.id,
    projectId,
    sanitizePatch(patch),
  );

  if (!project) {
    return { status: "fout", message: "Dit project bestaat niet meer." };
  }

  // De projectlijst en de detailpagina tonen titel, duur en status; die zijn
  // na een autosave verouderd.
  revalidatePath(ROUTES.projects);
  revalidatePath(ROUTES.project(projectId));

  return {
    status: "opgeslagen",
    savedAt: project.updatedAt,
    durationInSeconds: project.durationInSeconds,
  };
}


/**
 * Een export aanvragen.
 *
 * Per gekozen platform wordt hier één renderjob ingestuurd. Er wordt niets
 * gerenderd in dit verzoek: de actie bouwt het renderplan, laat de wachtrij
 * weten wat er moet gebeuren en geeft de jobids terug waarmee de editor de
 * voortgang volgt.
 *
 * Twee keer op de knop duwen levert geen twee renders op. De id van een job
 * volgt uit project, preset en renderplan (`src/lib/render/fingerprint.ts`),
 * dus de tweede opdracht is letterlijk dezelfde als de eerste en wordt door
 * BullMQ genegeerd.
 */
export async function exportProjectAction(projectId: ID, presetIds: ID[]): Promise<ExportState> {
  const { organisation, user } = await assertPermission("project:edit");

  if (!isQueueConfigured()) {
    return {
      status: "fout",
      message: "De renderwachtrij is niet geconfigureerd. Zet REDIS_URL en start de worker.",
    };
  }

  const project = await getProjectStore().findProject(organisation.id, projectId);
  if (!project) return { status: "fout", message: "Dit project bestaat niet meer." };

  if (presetIds.length === 0) {
    return { status: "fout", message: "Kies minstens één platform om naar te exporteren." };
  }

  const document = toEditorDocument(project);

  // Dezelfde doorrekening als in de editor, maar op wat er nú op de server
  // staat. De browser mag hier niet het laatste woord hebben: een tabblad dat
  // een uur openstond, weet niet meer wat er intussen bewaard is.
  const batch = buildExportBatch(presetIds, {
    aspectRatio: project.aspectRatio,
    durationInSeconds: project.durationInSeconds,
    sceneCount: project.scenes.length,
    title: project.title,
  });

  if (batch.blocking.length > 0) {
    return { status: "fout", message: batch.blocking[0]!.message };
  }

  if (batch.items.length === 0) {
    return { status: "fout", message: "Geen van de gekozen platformen bestaat nog." };
  }

  const requests: ExportRequest[] = [];

  // Alleen bij ontwikkelen: dan draait de worker mee in dit proces.
  ensureInlineRenderWorker();

  for (const item of batch.items) {
    const { job, reason } = await enqueueRenderJob({
      organisationId: organisation.id,
      projectId,
      presetId: item.preset.id,
      requestedBy: user.id,
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
  }

  // De worker zet de status verder (`renderen`, `klaar`, `mislukt`); dit is
  // alleen wat er nu al klopt, zodat de lijst niet achterloopt tot de eerste
  // worker wakker wordt.
  await getProjectStore().setProjectStatus(organisation.id, projectId, "wachtrij");

  revalidatePath(ROUTES.projects);
  revalidatePath(ROUTES.project(projectId));

  return {
    status: "wachtrij",
    message:
      requests.length === 1
        ? `${requests[0]!.label} staat in de wachtrij.`
        : `${requests.length} exports staan in de wachtrij.`,
    requests,
  };
}
