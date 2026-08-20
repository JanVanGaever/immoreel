"use server";

import { isApiError } from "@/lib/api/errors";
import { assertPermission } from "@/lib/auth/session";
import type { ExportState, SaveState } from "@/lib/editor/action-state";
import type { ProjectPatch } from "@/lib/editor/document";
import type { EditorErrors } from "@/lib/editor/validation";
import { startRenders } from "@/lib/projects/renders";
import { saveProjectPatch } from "@/lib/projects/service";
import type { ID } from "@/types";

/**
 * De serveracties van de editor.
 *
 * De editor bewaart automatisch, maar dat maakt de browser niet
 * betrouwbaarder: rol, eigenaarschap en validatie gaan hier opnieuw door de
 * molen, precies zoals bij de wizard.
 *
 * Het werk zelf staat in `src/lib/projects/`, want de HTTP-API doet exact
 * hetzelfde. Wat hier overblijft is de vertaling: van een gegooide fout naar
 * de vorm waarin `useActionState` haar verwacht.
 */

export async function saveProjectAction(projectId: ID, patch: ProjectPatch): Promise<SaveState> {
  const { organisation } = await assertPermission("project:edit");

  try {
    const project = await saveProjectPatch(organisation.id, projectId, patch);

    return {
      status: "opgeslagen",
      savedAt: project.updatedAt,
      durationInSeconds: project.durationInSeconds,
    };
  } catch (error) {
    if (!isApiError(error)) throw error;

    // De velden van een `ApiError` zijn dezelfde als die van `EditorErrors`:
    // ze komen uit `validatePatch()`, alleen dan zonder de lege plekken.
    return { status: "fout", message: error.message, fieldErrors: error.fields as EditorErrors };
  }
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

  try {
    // Het echte werk staat in `lib/projects/renders.ts`, zodat de knop in de
    // editor en `POST /api/projects/:id/renders` niet uit elkaar kunnen lopen.
    const { requests } = await startRenders({
      organisationId: organisation.id,
      requestedBy: user.id,
      projectId,
      presetIds,
    });

    return {
      status: "wachtrij",
      message:
        requests.length === 1
          ? `${requests[0]!.label} staat in de wachtrij.`
          : `${requests.length} exports staan in de wachtrij.`,
      requests,
    };
  } catch (error) {
    // Wat de service gooit, is al in het Nederlands en al voor de gebruiker
    // geschreven; hier wordt het alleen de vorm die de knop verwacht.
    if (isApiError(error)) return { status: "fout", message: error.message };

    throw error;
  }
}
