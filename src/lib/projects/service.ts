import { revalidatePath } from "next/cache";
import { getBrandKitStore } from "@/db/brand-kit-store";
import { getProjectStore } from "@/db/project-store";
import { getTemplateStore } from "@/db/template-store";
import { invalidInput, notFound } from "@/lib/api/errors";
import { ROUTES } from "@/lib/constants";
import type { ProjectPatch } from "@/lib/editor/document";
import { hasErrors, sanitizePatch, validatePatch } from "@/lib/editor/validation";
import {
  hasErrors as hasDraftErrors,
  validateInput,
} from "@/lib/new-project/validation";
import { mergeProjectPatch, type ProjectChanges } from "@/lib/projects/patch";
import type { ID, NewProjectInput, VideoProject } from "@/types";

/**
 * Alles wat er met een project gebeurt, één keer geschreven.
 *
 * De routes eronder zijn daardoor kort: sessie ophalen, verzoek uitpakken, dit
 * aanroepen, antwoorden. Dat is niet alleen netter — het is de enige manier
 * waarop de API en de serveracties van de editor niet uit elkaar kunnen lopen.
 * Ze delen de validatie (`lib/editor/validation.ts`), de normalisatie
 * (`toProjectPatch`) en de regel dat een project altijd binnen zijn eigen
 * organisatie opgezocht wordt.
 *
 * Fouten worden gegooid en niet teruggegeven: het zijn `ApiError`s, en de rand
 * van de route (`handle()`) maakt er een antwoord van.
 */

export async function listOwnProjects(organisationId: ID): Promise<VideoProject[]> {
  return getProjectStore().listProjects(organisationId);
}

/**
 * Het project van dit kantoor, of een 404.
 *
 * Het opzoeken *is* de rechtencontrole: `findProject()` neemt de organisatie
 * mee, dus een id uit een URL zegt op zichzelf niets. Een project van een ander
 * kantoor bestaat hier niet — geen 403, want dat zou bevestigen dat het id
 * klopt.
 */
export async function loadOwnProject(organisationId: ID, projectId: ID): Promise<VideoProject> {
  const project = await getProjectStore().findProject(organisationId, projectId);
  if (!project) throw notFound("Onbekend project.");

  return project;
}

/** Van wizardgegevens naar een project. Dezelfde validatie als de wizard zelf. */
export async function createOwnProject(
  organisationId: ID,
  input: NewProjectInput,
): Promise<VideoProject> {
  const templates = await getTemplateStore().listTemplates(organisationId);
  const fieldErrors = validateInput(input, templates);

  if (hasDraftErrors(fieldErrors)) {
    throw invalidInput("Er ontbreekt nog iets aan dit project.", fieldErrors);
  }

  const project = await getProjectStore().createProject(organisationId, input);

  revalidatePath(ROUTES.projects);
  revalidatePath(ROUTES.dashboard);

  return project;
}

/**
 * Een deelwijziging bewaren.
 *
 * De wijziging wordt eerst een volledig bewaarverzoek (`mergeProjectPatch`) en
 * gaat daarna door dezelfde molen als een autosave uit de editor. Dat is met
 * opzet: wie via de API een beeldverhouding wijzigt waar het template niet bij
 * past, hoort dezelfde melding te krijgen als wie dat in de editor doet.
 */
export async function saveProjectChanges(
  organisationId: ID,
  projectId: ID,
  changes: ProjectChanges,
): Promise<VideoProject> {
  const project = await loadOwnProject(organisationId, projectId);
  const brand = await getBrandKitStore().getBrandKit(organisationId);

  return saveProjectPatch(organisationId, projectId, mergeProjectPatch(project, brand, changes));
}

/** Een volledig bewaarverzoek: valideren, rechttrekken, wegschrijven. */
export async function saveProjectPatch(
  organisationId: ID,
  projectId: ID,
  patch: ProjectPatch,
): Promise<VideoProject> {
  const templates = await getTemplateStore().listTemplates(organisationId);
  const fieldErrors = validatePatch(patch, templates);

  if (hasErrors(fieldErrors)) {
    throw invalidInput("Deze wijziging kon niet bewaard worden.", stripEmpty(fieldErrors));
  }

  const project = await getProjectStore().updateProject(
    organisationId,
    projectId,
    sanitizePatch(patch),
  );

  // Weg tussen het opzoeken en het bewaren; zeldzaam, maar niet onmogelijk.
  if (!project) throw notFound("Dit project bestaat niet meer.");

  // De lijst en de detailpagina tonen titel, duur en status.
  revalidatePath(ROUTES.projects);
  revalidatePath(ROUTES.project(projectId));

  return project;
}

/**
 * `EditorErrors` heeft velden die `undefined` mogen zijn; de foutvorm van de
 * API heeft dat niet. Hier valt dat verschil weg.
 */
function stripEmpty(errors: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
