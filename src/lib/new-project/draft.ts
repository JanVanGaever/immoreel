import { templateStyle } from "@/lib/editor/templates";
import { getGoal } from "@/lib/new-project/presets";
import type {
  AspectRatio,
  DraftPhoto,
  ID,
  NewProjectInput,
  ProjectDraft,
  ProjectGoal,
  Template,
} from "@/types";

/**
 * Rekenwerk op een concept: presets toepassen, foto's ordenen en er
 * uiteindelijk een `NewProjectInput` van maken. Allemaal pure functies, zodat
 * de wizard (client) en de serveractie exact hetzelfde resultaat krijgen.
 */

/** Intro en outro van het template, bovenop de scènes zelf. */
export const INTRO_OUTRO_SECONDS = 4;

export function createEmptyDraft(): ProjectDraft {
  return {
    title: "",
    goal: null,
    aspectRatio: null,
    templateId: null,
    photos: [],
    choseAspectRatio: false,
    choseTemplate: false,
    updatedAt: new Date().toISOString(),
  };
}

/** Een concept waar nog niets in staat, hoeft niet bewaard te worden. */
export function isDraftEmpty(draft: ProjectDraft): boolean {
  return (
    draft.title.trim() === "" &&
    draft.goal === null &&
    draft.aspectRatio === null &&
    draft.templateId === null &&
    draft.photos.length === 0
  );
}

/** Elke wijziging gaat hierlangs, zodat `updatedAt` altijd klopt. */
function touch(draft: ProjectDraft, changes: Partial<ProjectDraft>): ProjectDraft {
  return { ...draft, ...changes, updatedAt: new Date().toISOString() };
}

export function templatesForRatio(templates: Template[], ratio: AspectRatio): Template[] {
  return templates.filter((template) => template.aspectRatios.includes(ratio));
}

/**
 * Het template dat we willen, of het eerste dat bij de verhouding past.
 * Zo blijft de preset werken ook als de catalogus verandert.
 */
export function resolveTemplateId(
  templates: Template[],
  preferredId: ID | null,
  ratio: AspectRatio,
): ID | null {
  const fitting = templatesForRatio(templates, ratio);
  const preferred = fitting.find((template) => template.id === preferredId);

  return preferred?.id ?? fitting[0]?.id ?? null;
}

export function setTitle(draft: ProjectDraft, title: string): ProjectDraft {
  return touch(draft, { title });
}

/**
 * Stap 2 doet het meeste werk: het doel vult formaat en template in. Wat de
 * gebruiker zelf al koos, blijft staan.
 */
export function applyGoal(draft: ProjectDraft, goal: ProjectGoal, templates: Template[]): ProjectDraft {
  const { preset } = getGoal(goal);
  const aspectRatio = draft.choseAspectRatio && draft.aspectRatio ? draft.aspectRatio : preset.aspectRatio;
  const templateId = draft.choseTemplate
    ? resolveTemplateId(templates, draft.templateId, aspectRatio)
    : resolveTemplateId(templates, preset.templateId, aspectRatio);

  return touch(draft, { goal, aspectRatio, templateId });
}

/**
 * Een andere verhouding kan het gekozen template ongeldig maken. In plaats van
 * de gebruiker met een foutmelding op te zadelen, schuiven we naar het
 * dichtstbijzijnde template dat wél past.
 */
export function setAspectRatio(
  draft: ProjectDraft,
  aspectRatio: AspectRatio,
  templates: Template[],
): ProjectDraft {
  const preferred = draft.choseTemplate
    ? draft.templateId
    : (draft.goal ? getGoal(draft.goal).preset.templateId : draft.templateId);

  return touch(draft, {
    aspectRatio,
    choseAspectRatio: true,
    templateId: resolveTemplateId(templates, preferred, aspectRatio),
  });
}

export function setTemplateId(draft: ProjectDraft, templateId: ID): ProjectDraft {
  return touch(draft, { templateId, choseTemplate: true });
}

export function addPhotos(draft: ProjectDraft, photos: DraftPhoto[]): ProjectDraft {
  return touch(draft, { photos: [...draft.photos, ...photos] });
}

export function removePhoto(draft: ProjectDraft, photoId: ID): ProjectDraft {
  return touch(draft, { photos: draft.photos.filter((photo) => photo.id !== photoId) });
}

/** Verplaatst één foto in de tijdlijn; buiten de lijst gebeurt er niets. */
export function movePhoto(draft: ProjectDraft, photoId: ID, offset: number): ProjectDraft {
  const from = draft.photos.findIndex((photo) => photo.id === photoId);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= draft.photos.length) return draft;

  const photos = [...draft.photos];
  const [moved] = photos.splice(from, 1);
  photos.splice(to, 0, moved!);

  return touch(draft, { photos });
}

/**
 * Hoe lang elke foto in beeld blijft, volgens het gekozen template.
 *
 * Uit het template en niet uit het doel: het doel kiest alleen een template als
 * vertrekpunt, en wie in stap 4 een ander template neemt, verwacht het tempo
 * van dát template. Zonder template — een project van vóór de catalogus, of een
 * API-verzoek zonder — geldt de standaard uit `FALLBACK_TEMPLATE_STYLE`.
 *
 * Dit is dezelfde bron als `syncUploads()` in de editor en
 * `uploadProjectAssets()` op de server gebruiken. Eén getal, drie lezers.
 */
export function secondsPerPhotoFor(templateId: ID | null | undefined): number {
  return templateStyle(templateId).secondsPerPhoto;
}

/** De lengte die de render ongeveer wordt; genoeg voor de samenvatting. */
export function estimateDurationInSeconds(photoCount: number, secondsPerPhoto: number): number {
  if (photoCount === 0) return 0;

  return Math.round(photoCount * secondsPerPhoto + INTRO_OUTRO_SECONDS);
}

/*
 * Hier stond `buildScenes()`: één scène per conceptfoto, met `assetId` gelijk
 * aan het id van de `DraftPhoto`. Dat id komt uit `createPhotoId()` in de
 * browser en is nooit een rij in `project_assets` geworden, dus wees elke zo
 * gemaakte scène naar een bestand dat niet bestond — een render erop brak af
 * met `assets-missing`.
 *
 * De tijdlijn ontstaat nu waar de bestanden ontstaan: in
 * `uploadProjectAssets()`, nadat de wizard de foto's geüpload heeft.
 */

/**
 * Het resultaat van de wizard. `null` zolang er nog iets ontbreekt — de
 * knop naar de editor blijft dan uit.
 */
export function buildNewProjectInput(draft: ProjectDraft): NewProjectInput | null {
  if (!draft.goal || !draft.aspectRatio || !draft.templateId) return null;
  if (draft.title.trim() === "" || draft.photos.length === 0) return null;

  return {
    title: draft.title.trim(),
    goal: draft.goal,
    aspectRatio: draft.aspectRatio,
    templateId: draft.templateId,
    photos: draft.photos,
    secondsPerPhoto: secondsPerPhotoFor(draft.templateId),
  };
}
