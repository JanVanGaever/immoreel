import { clampAudio } from "@/lib/editor/audio";
import { clampSceneSeconds, MAX_SCENES, type ProjectPatch } from "@/lib/editor/document";
import { normaliseExportPresetIds } from "@/lib/editor/export-presets";
import { normaliseMotion } from "@/lib/editor/motion";
import { templatesForRatio } from "@/lib/new-project/draft";
import { validateTitle } from "@/lib/new-project/validation";
import type { AspectRatio, Template } from "@/types";

/**
 * Wat de server met een bewaarverzoek doet.
 *
 * De editor bewaart automatisch en dus vaak. Wat er binnenkomt is daarom
 * bewust twee dingen tegelijk: wat écht fout is wordt geweigerd (`validate`),
 * en wat alleen buiten de grenzen valt wordt rechtgetrokken (`sanitize`). Een
 * scène van 400 seconden mag geen autosave laten mislukken — die wordt gewoon
 * 15 seconden, precies zoals de regelaar in de browser ook zou doen.
 *
 * De titelregels komen uit de wizard: hetzelfde project, dezelfde grenzen.
 */

export type EditorField = "title" | "aspectRatio" | "templateId" | "scenes";

export type EditorErrors = Partial<Record<EditorField, string>>;

const ASPECT_RATIOS: readonly AspectRatio[] = ["16:9", "9:16", "1:1", "4:5"];

export function validatePatch(patch: ProjectPatch, templates: Template[]): EditorErrors {
  const errors: EditorErrors = {};

  errors.title = validateTitle(patch.title);

  if (!ASPECT_RATIOS.includes(patch.aspectRatio)) {
    errors.aspectRatio = "Onbekende beeldverhouding.";
  } else if (patch.templateId) {
    const fitting = templatesForRatio(templates, patch.aspectRatio);

    if (!fitting.some((template) => template.id === patch.templateId)) {
      errors.templateId = "Dit template past niet bij de gekozen beeldverhouding.";
    }
  }

  if (patch.scenes.length > MAX_SCENES) {
    errors.scenes = `Maximaal ${MAX_SCENES} scènes per video.`;
  }

  return errors;
}

export function hasErrors(errors: EditorErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/**
 * Alles binnen de grenzen zetten. Draait ná de validatie: wat hier
 * bijgeschaafd wordt, is nooit iets waar de gebruiker een melding voor
 * verdient.
 */
export function sanitizePatch(patch: ProjectPatch): ProjectPatch {
  return {
    ...patch,
    title: patch.title.trim(),
    scenes: patch.scenes.map((scene, index) => ({
      ...scene,
      order: index,
      durationInSeconds: clampSceneSeconds(scene.durationInSeconds),
      motion: normaliseMotion(scene.motion),
      captionTop: scene.captionTop?.trim() || null,
      captionBottom: scene.captionBottom?.trim() || null,
    })),
    audio: clampAudio(patch.audio),
    // Een preset die niet (meer) bestaat, verdwijnt stil: de gebruiker heeft
    // hem ooit gekozen, maar de catalogus is intussen de waarheid. Oude ids
    // worden onderweg hun opvolger (zie `normaliseExportPresetIds`).
    exportPresetIds: normaliseExportPresetIds(patch.exportPresetIds),
  };
}
