"use server";

import { revalidatePath } from "next/cache";
import { getProjectStore } from "@/db/project-store";
import { getTemplateStore } from "@/db/template-store";
import { assertPermission } from "@/lib/auth/session";
import type { ExportRequest, ExportState, SaveState } from "@/lib/editor/action-state";
import type { ProjectPatch } from "@/lib/editor/document";
import { exportWarnings, findExportPreset } from "@/lib/editor/export-presets";
import { hasErrors, sanitizePatch, validatePatch } from "@/lib/editor/validation";
import { ROUTES } from "@/lib/constants";
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
 * Er wordt hier niets gerenderd: de wachtrij en de renderworker bestaan nog
 * niet (zie `src/workers/`). Wat er wél gebeurt, is alles eromheen — rechten,
 * presets nakijken, blokkerende waarschuwingen tegenhouden en de status van
 * het project op `wachtrij` zetten. Zodra `getQueue()` werkt, is dit één
 * `enqueue`-regel per preset.
 */
export async function exportProjectAction(
  projectId: ID,
  presetIds: ID[],
): Promise<ExportState> {
  const { organisation } = await assertPermission("project:edit");

  const project = await getProjectStore().findProject(organisation.id, projectId);
  if (!project) return { status: "fout", message: "Dit project bestaat niet meer." };

  if (presetIds.length === 0) {
    return { status: "fout", message: "Kies minstens één platform om naar te exporteren." };
  }

  const requests: ExportRequest[] = [];

  for (const presetId of presetIds) {
    const preset = findExportPreset(presetId);
    if (!preset) continue;

    const blocking = exportWarnings(preset, project.aspectRatio, project.durationInSeconds).filter(
      (warning) => warning.level === "blokkerend",
    );

    if (blocking.length > 0) {
      return { status: "fout", message: blocking[0]!.message };
    }

    requests.push({
      presetId: preset.id,
      label: preset.label,
      format: `${preset.width}x${preset.height} · ${preset.fps} fps`,
    });
  }

  if (requests.length === 0) {
    return { status: "fout", message: "Geen van de gekozen platformen bestaat nog." };
  }

  // TODO: één `getQueue().enqueue("render.video", { projectId, requestedBy })`
  // per preset zodra de wachtrij er is.
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
