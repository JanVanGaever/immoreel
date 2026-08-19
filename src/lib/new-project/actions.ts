"use server";

import { redirect } from "next/navigation";
import { getProjectStore } from "@/db/project-store";
import { getTemplateStore } from "@/db/template-store";
import { assertPermission } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import type { NewProjectActionState } from "@/lib/new-project/action-state";
import { hasErrors, validateInput } from "@/lib/new-project/validation";
import type { NewProjectInput } from "@/types";

/**
 * De laatste stap van de wizard: van concept naar echt project.
 *
 * Wat de client stuurt is een suggestie — rol, rechten en validatie gaan hier
 * opnieuw door de molen, precies zoals bij de auth-acties.
 */
export async function createProjectAction(
  input: NewProjectInput,
): Promise<NewProjectActionState> {
  const { organisation } = await assertPermission("project:create");

  const templates = await getTemplateStore().listTemplates(organisation.id);
  const fieldErrors = validateInput(input, templates);

  if (hasErrors(fieldErrors)) {
    return {
      status: "error",
      message: "Er ontbreekt nog iets. Kijk de gemarkeerde stap na.",
      fieldErrors,
    };
  }

  const project = await getProjectStore().createProject(organisation.id, input);

  // `redirect()` gooit; alles hierboven is dus al afgerond.
  redirect(ROUTES.editor(project.id));
}
