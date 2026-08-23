"use server";

import { getProjectStore } from "@/db/project-store";
import { getTemplateStore } from "@/db/template-store";
import { assertPermission } from "@/lib/auth/session";
import type { NewProjectActionState } from "@/lib/new-project/action-state";
import { hasErrors, validateInput } from "@/lib/new-project/validation";
import type { NewProjectInput } from "@/types";

/**
 * De laatste stap van de wizard: van concept naar echt project.
 *
 * Wat de client stuurt is een suggestie — rol, rechten en validatie gaan hier
 * opnieuw door de molen, precies zoals bij de auth-acties.
 *
 * Het project komt hier leeg vandaan: wel een titel, een formaat en een
 * template, nog geen scènes. De foto's zitten op dit moment nog in de browser
 * en gaan er in de stap hierna naartoe (`POST /api/projects/:id/assets`), en
 * dáár ontstaat de tijdlijn. Vandaar ook dat deze actie het id teruggeeft in
 * plaats van meteen door te sturen — wie hier `redirect()` doet, laat de
 * gebruiker in een editor zonder foto's achter.
 */
export async function createProjectAction(
  input: NewProjectInput,
): Promise<NewProjectActionState> {
  const { organisation } = await assertPermission("project:create");

  const templates = await getTemplateStore().listTemplates(organisation.id);
  const fieldErrors = validateInput(input, templates);

  if (hasErrors(fieldErrors)) {
    return {
      status: "fout",
      message: "Er ontbreekt nog iets. Kijk de gemarkeerde stap na.",
      fieldErrors,
    };
  }

  const project = await getProjectStore().createProject(organisation.id, input);

  return { status: "gelukt", projectId: project.id };
}
