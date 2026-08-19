import { templatesForRatio } from "@/lib/new-project/draft";
import { PHOTO_UPLOAD_CONSTRAINTS } from "@/lib/uploads/validation";
import type { WizardStepId } from "@/lib/new-project/steps";
import type { DraftPhoto, NewProjectInput, ProjectDraft, Template } from "@/types";

/**
 * Validatie van de wizard. Dezelfde functies draaien op de client (meteen
 * feedback bij "Volgende") en op de server (de serveractie vertrouwt niets
 * van wat er binnenkomt) — net als bij de auth-formulieren.
 */

export type DraftField = "title" | "goal" | "aspectRatio" | "templateId" | "photos";

export type DraftErrors = Partial<Record<DraftField, string>>;

export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 80;

/** Onder dit aantal valt er niets te monteren; boven de bovengrens wordt het onwerkbaar. */
export const MIN_PHOTOS = 3;

// Wat een foto mag zijn, staat bij de uploadflow: de wizard en de
// mediabibliotheek horen dezelfde bestanden te accepteren.
export const MAX_PHOTOS = PHOTO_UPLOAD_CONSTRAINTS.maxFiles;
export const MAX_PHOTO_BYTES = PHOTO_UPLOAD_CONSTRAINTS.maxBytes;
export const ACCEPTED_PHOTO_TYPES = PHOTO_UPLOAD_CONSTRAINTS.acceptedMimeTypes;

export { rejectionReason } from "@/lib/uploads/validation";

export function validateTitle(value: string): string | undefined {
  const title = value.trim();

  if (!title) return "Geef het project een naam.";
  if (title.length < TITLE_MIN_LENGTH) return "Deze naam is te kort.";
  if (title.length > TITLE_MAX_LENGTH) return `Hou het onder ${TITLE_MAX_LENGTH} tekens.`;

  return undefined;
}

export function validatePhotos(photos: DraftPhoto[]): string | undefined {
  if (photos.length === 0) return "Voeg minstens één foto toe om te beginnen.";
  if (photos.length < MIN_PHOTOS) {
    const missing = MIN_PHOTOS - photos.length;
    return missing === 1
      ? "Nog één foto en je kan verder."
      : `Voeg er nog ${missing} toe: een video heeft minstens ${MIN_PHOTOS} foto's nodig.`;
  }
  if (photos.length > MAX_PHOTOS) return `Maximaal ${MAX_PHOTOS} foto's per video.`;

  return undefined;
}

/** Alles wat gevalideerd kan worden, of het nu een concept of een verzonden project is. */
type Validatable = Pick<ProjectDraft, "title" | "goal" | "aspectRatio" | "templateId" | "photos">;

/** Validatie van één stap: precies de velden die op dat scherm staan. */
export function validateStep(
  step: WizardStepId,
  draft: Validatable,
  templates: Template[],
): DraftErrors {
  const errors: DraftErrors = {};

  switch (step) {
    case "naam": {
      errors.title = validateTitle(draft.title);
      break;
    }
    case "doel": {
      if (!draft.goal) errors.goal = "Kies waar de video terechtkomt.";
      break;
    }
    case "formaat": {
      if (!draft.aspectRatio) errors.aspectRatio = "Kies een beeldverhouding.";
      break;
    }
    case "template": {
      if (!draft.templateId) {
        errors.templateId = "Kies een template.";
        break;
      }
      const template = templates.find((item) => item.id === draft.templateId);
      if (!template) {
        errors.templateId = "Dit template bestaat niet meer. Kies een ander.";
      } else if (draft.aspectRatio && !template.aspectRatios.includes(draft.aspectRatio)) {
        errors.templateId = `${template.name} werkt niet in ${draft.aspectRatio}. Kies een ander template.`;
      }
      break;
    }
    case "fotos": {
      errors.photos = validatePhotos(draft.photos);
      break;
    }
    case "start": {
      return validateDraft(draft, templates);
    }
  }

  return stripEmpty(errors);
}

/** Alle stappen samen; wat de serveractie draait voor ze iets aanmaakt. */
export function validateDraft(draft: Validatable, templates: Template[]): DraftErrors {
  const errors: DraftErrors = {
    ...validateStep("naam", draft, templates),
    ...validateStep("doel", draft, templates),
    ...validateStep("formaat", draft, templates),
    ...validateStep("template", draft, templates),
    ...validateStep("fotos", draft, templates),
  };

  // Formaat en template mogen niet uit elkaar lopen: het template moet de
  // gekozen verhouding aankunnen, anders klopt de render niet.
  if (!errors.templateId && draft.aspectRatio && templatesForRatio(templates, draft.aspectRatio).length === 0) {
    errors.aspectRatio = "Voor deze verhouding is er nog geen template.";
  }

  return stripEmpty(errors);
}

export function validateInput(input: NewProjectInput, templates: Template[]): DraftErrors {
  return validateDraft(input, templates);
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** Houdt alleen de velden over die écht een melding hebben. */
function stripEmpty(errors: DraftErrors): DraftErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message)));
}
