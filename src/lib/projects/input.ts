import { randomUUID } from "node:crypto";
import { InputReader } from "@/lib/api/input";
import { invalidInput } from "@/lib/api/errors";
import { ASPECT_RATIO_OPTIONS } from "@/lib/aspect-ratios";
import { LOGO_PLACEMENTS } from "@/lib/editor/branding";
import { MAX_SCENE_SECONDS, MAX_SCENES, MIN_SCENE_SECONDS } from "@/lib/editor/document";
import { EASING_OPTIONS, MAX_SPEED, MIN_SPEED, MOTION_OPTIONS } from "@/lib/editor/motion";
import { TRANSITION_OPTIONS } from "@/lib/editor/templates";
import { BRAND_FONTS } from "@/lib/brand/fonts";
import { GOAL_OPTIONS, getGoal } from "@/lib/new-project/presets";
import { MAX_PHOTOS, TITLE_MAX_LENGTH } from "@/lib/new-project/validation";
import { PHOTO_UPLOAD_CONSTRAINTS, rejectionReason } from "@/lib/uploads/validation";
import type { SceneInput, ProjectChanges } from "@/lib/projects/patch";
import type { AspectRatio, DraftPhoto, ID, NewProjectInput, ProjectGoal, SceneMotion } from "@/types";

/**
 * Wat de projectroutes van een verzoek maken.
 *
 * Elke keuzelijst hieronder komt uit de catalogus waar ze thuishoort — de
 * beeldverhoudingen uit `lib/aspect-ratios.ts`, de bewegingen uit
 * `lib/editor/motion.ts`, de lettertypes uit `lib/brand/fonts.ts`. Ze hier
 * uitschrijven zou betekenen dat een nieuwe overgang op twee plekken toegevoegd
 * moet worden, en dan is de API de plek die vergeten wordt.
 *
 * De regels over inhoud staan er bewust niet: die draaien verderop, in dezelfde
 * validatiemodules als de wizard en de editor gebruiken. Hier wordt alleen de
 * vorm gecontroleerd (zie `src/lib/api/input.ts`).
 */

export const ASPECT_RATIOS: readonly AspectRatio[] = ASPECT_RATIO_OPTIONS.map(
  (option) => option.id,
);
const GOALS: readonly ProjectGoal[] = GOAL_OPTIONS.map((option) => option.id);
const MOTION_KINDS = MOTION_OPTIONS.map((option) => option.id);
const MOTION_EASINGS = EASING_OPTIONS.map((option) => option.id);
const TRANSITIONS = TRANSITION_OPTIONS.map((option) => option.id);
const PLACEMENTS = LOGO_PLACEMENTS.map((option) => option.id);
const FONT_IDS = BRAND_FONTS.map((font) => font.id);

/** Wat er op een scène past zonder dat het beeld een tekstblok wordt. */
const CAPTION_MAX_LENGTH = 90;

/* -------------------------------------------------------------------------
 * Een nieuw project
 * ---------------------------------------------------------------------- */

/**
 * Het lichaam van `POST /api/projects`: hetzelfde als wat de wizard oplevert.
 *
 * `photos[].id` is het id van de foto in de opslag wanneer die er al is (zie
 * `POST /api/projects/:id/assets`). Staat er niets, dan krijgt de foto een id
 * van ons — de scène verwijst dan naar een asset die er nog moet komen,
 * precies zoals de wizard het vandaag doet.
 */
export function readNewProjectInput(body: Record<string, unknown>): NewProjectInput {
  const reader = new InputReader(body);

  const title = reader.requiredText("title", { max: TITLE_MAX_LENGTH });
  const goal = reader.requiredChoice("goal", GOALS);
  const aspectRatio = reader.requiredChoice("aspectRatio", ASPECT_RATIOS);
  const templateId = reader.requiredText("templateId");
  const secondsPerPhoto = reader.number("secondsPerPhoto", {
    min: MIN_SCENE_SECONDS,
    max: MAX_SCENE_SECONDS,
  });

  if (!reader.has("photos")) reader.fail("photos", "Voeg minstens één foto toe om te beginnen.");
  const photos = reader.objectList("photos", readDraftPhoto, { max: MAX_PHOTOS }) ?? [];

  reader.done();

  return {
    title,
    // Na `done()` staat vast dat deze twee er zijn: anders was er hierboven een
    // 400 gegooid.
    goal: goal!,
    aspectRatio: aspectRatio!,
    templateId,
    photos,
    secondsPerPhoto: secondsPerPhoto ?? getGoal(goal!).preset.secondsPerPhoto,
  };
}

function readDraftPhoto(reader: InputReader): DraftPhoto {
  const fileName = reader.requiredText("fileName", { max: 255 });
  const mimeType = reader.requiredText("mimeType", { max: 100 });
  const sizeInBytes = reader.requiredNumber("sizeInBytes", { min: 1, integer: true });

  // Dezelfde regels als de uploadzone in de browser: wat daar geweigerd wordt,
  // hoort hier ook niet binnen te komen.
  const reason = rejectionReason(
    { name: fileName, type: mimeType, size: sizeInBytes },
    PHOTO_UPLOAD_CONSTRAINTS,
  );
  if (reason) reader.fail("fileName", reason);

  return {
    id: reader.text("id", { max: 64 }) || `pho_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    fileName,
    mimeType,
    sizeInBytes,
    // Een `previewUrl` is een blob-URL uit één tabblad. Die heeft op de server
    // geen betekenis en gaat er dus niet in.
    previewUrl: null,
  };
}

/* -------------------------------------------------------------------------
 * Een bestaand project wijzigen
 * ---------------------------------------------------------------------- */

/**
 * Het lichaam van `PATCH /api/projects/:projectId`.
 *
 * Alles is optioneel: wat er niet in staat, verandert niet. `scenes` is daarop
 * de uitzondering — die lijst is de hele tijdlijn, want een deelbewerking op
 * een tijdlijn ("zet scène 3 twee plekken naar voren") is een tweede taal die
 * de editor toch niet spreekt. Instellingen van een scène die blijft bestaan,
 * gaan niet verloren: wat je bij een scène weglaat, blijft wat het was (zie
 * `mergeProjectPatch`).
 */
export function readProjectChanges(body: Record<string, unknown>): ProjectChanges {
  const reader = new InputReader(body);
  const changes: ProjectChanges = {};

  if (reader.has("title")) changes.title = reader.requiredText("title", { max: TITLE_MAX_LENGTH });
  if (reader.has("scenes")) {
    changes.scenes = reader.objectList("scenes", readScene, { max: MAX_SCENES }) ?? [];
  }

  readSettingsInto(reader, changes);
  reader.done();

  if (Object.keys(changes).length === 0) {
    throw invalidInput("Er staat niets in dit verzoek om te wijzigen.");
  }

  return changes;
}

/**
 * Het lichaam van `PUT /api/projects/:projectId/settings`: alles wat over de
 * video als geheel gaat, zoals in het tabblad "Video" van de editor.
 *
 * Titel en tijdlijn horen hier niet: dat zijn de twee dingen die je aan het
 * maken bent, niet iets wat je instelt. Ze meesturen levert een fout op in
 * plaats van stilte, want stil negeren is hoe een client denkt dat hij iets
 * bewaard heeft.
 */
export function readProjectSettings(body: Record<string, unknown>): ProjectChanges {
  const reader = new InputReader(body);
  const changes: ProjectChanges = {};

  for (const field of ["title", "scenes"] as const) {
    if (reader.has(field)) {
      reader.fail(field, "Dit wijzig je met PATCH op het project zelf.");
    }
  }

  readSettingsInto(reader, changes);
  reader.done();

  if (Object.keys(changes).length === 0) {
    throw invalidInput("Er staat geen enkele instelling in dit verzoek.");
  }

  return changes;
}

/** De velden die `PATCH` en `PUT /settings` delen. */
function readSettingsInto(reader: InputReader, changes: ProjectChanges): void {
  if (reader.has("aspectRatio")) {
    changes.aspectRatio = reader.requiredChoice("aspectRatio", ASPECT_RATIOS);
  }

  // `null` haalt het template weg; afwezig laat het staan.
  if (reader.has("templateId")) changes.templateId = reader.nullableText("templateId") ?? null;

  if (reader.has("branding")) changes.branding = reader.object("branding", readBranding);
  if (reader.has("audio")) changes.audio = reader.object("audio", readAudio);
  if (reader.has("exportPresetIds")) {
    changes.exportPresetIds = reader.textList("exportPresetIds", { max: 40 }) ?? [];
  }
}

function readScene(reader: InputReader): SceneInput {
  const scene: SceneInput = {
    id: reader.text("id", { max: 64 }) || undefined,
    durationInSeconds: reader.number("durationInSeconds", {
      min: MIN_SCENE_SECONDS,
      max: MAX_SCENE_SECONDS,
    }),
  };

  if (reader.has("assetId")) scene.assetId = reader.nullableText("assetId", { max: 64 }) ?? null;
  if (reader.has("motion")) scene.motion = reader.object("motion", readMotion);
  if (reader.has("transition")) {
    scene.transition = reader.nullableChoice("transition", TRANSITIONS) ?? null;
  }
  if (reader.has("captionTop")) {
    scene.captionTop = reader.nullableText("captionTop", { max: CAPTION_MAX_LENGTH }) ?? null;
  }
  if (reader.has("captionBottom")) {
    scene.captionBottom = reader.nullableText("captionBottom", { max: CAPTION_MAX_LENGTH }) ?? null;
  }

  return scene;
}

/**
 * De beweging over één foto. Wat er binnenkomt is een deel van een
 * `SceneMotion`; `normaliseMotion()` maakt er verderop een hele van, met
 * dezelfde grenzen als de regelaars in de editor.
 */
function readMotion(reader: InputReader): Partial<SceneMotion> {
  return {
    kind: reader.choice("kind", MOTION_KINDS),
    intensity: reader.number("intensity", { min: 0, max: 1 }),
    speed: reader.number("speed", { min: MIN_SPEED, max: MAX_SPEED }),
    easing: reader.choice("easing", MOTION_EASINGS),
    focusX: reader.number("focusX", { min: 0, max: 1 }),
    focusY: reader.number("focusY", { min: 0, max: 1 }),
  };
}

/**
 * De huisstijlkeuzes van dit project. Elk overrulebaar veld mag `null` zijn, en
 * dat betekent hier niet "leeg" maar "volg de huisstijl van het kantoor" — zie
 * `src/lib/editor/branding.ts`.
 */
function readBranding(reader: InputReader) {
  return defined({
    logoPlacement: reader.choice("logoPlacement", PLACEMENTS),
    showContactCard: reader.boolean("showContactCard"),
    showPriceBadge: reader.boolean("showPriceBadge"),
    accentColor: reader.nullableText("accentColor", { max: 7 }),
    secondaryColor: reader.nullableText("secondaryColor", { max: 7 }),
    outroText: reader.nullableText("outroText", { max: 70 }),
    ctaText: reader.nullableText("ctaText", { max: 40 }),
    fontId: reader.nullableChoice("fontId", FONT_IDS),
    showWatermark: reader.nullableBoolean("showWatermark"),
    agentName: reader.nullableText("agentName", { max: 60 }),
    agentPhone: reader.nullableText("agentPhone", { max: 30 }),
    agentEmail: reader.nullableText("agentEmail", { max: 120 }),
  });
}

function readAudio(reader: InputReader) {
  return defined({
    trackId: reader.nullableText("trackId", { max: 64 }),
    volume: reader.number("volume", { min: 0, max: 1 }),
    fadeInSeconds: reader.number("fadeInSeconds", { min: 0 }),
    fadeOutSeconds: reader.number("fadeOutSeconds", { min: 0 }),
    duckUnderVoiceover: reader.boolean("duckUnderVoiceover"),
  });
}

/**
 * De velden die niet meekwamen eruit halen.
 *
 * Zonder dit zou een deelwijziging een volledige vervanging worden: de lezer
 * geeft `undefined` voor een veld dat er niet stond, en `{ ...huidig, ...nieuw }`
 * legt die `undefined` dan over de waarde die er wél was. Een verzoek dat
 * alleen het volume aanpast, zou zo het gekozen nummer wissen.
 */
function defined<T extends object>(source: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/* -------------------------------------------------------------------------
 * Volgorde en export
 * ---------------------------------------------------------------------- */

/** Het lichaam van `PUT /api/projects/:projectId/assets/order`. */
export function readAssetOrder(body: Record<string, unknown>): ID[] {
  const reader = new InputReader(body);

  if (!reader.has("assetIds")) reader.fail("assetIds", "Stuur de volledige volgorde mee.");
  const assetIds = reader.textList("assetIds", { max: MAX_PHOTOS }) ?? [];

  reader.done();

  return assetIds;
}

/** Het lichaam van `POST /api/projects/:projectId/renders`. */
export function readPresetIds(body: Record<string, unknown>): ID[] {
  const reader = new InputReader(body);

  if (!reader.has("presetIds")) {
    reader.fail("presetIds", "Kies minstens één platform om naar te exporteren.");
  }
  const presetIds = reader.textList("presetIds", { max: 40 }) ?? [];

  reader.done();

  return presetIds;
}
