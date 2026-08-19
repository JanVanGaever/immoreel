import { clampAudio, createAudio } from "@/lib/editor/audio";
import { createBranding } from "@/lib/editor/branding";
import { normaliseMotion } from "@/lib/editor/motion";
import { getTransition, templateStyle, type TransitionId } from "@/lib/editor/templates";
import type {
  AspectRatio,
  AudioSettings,
  BrandingSettings,
  ID,
  Scene,
  SceneMotion,
  VideoProject,
} from "@/types";

/**
 * Het document waar de editor op werkt.
 *
 * Dit is het project zonder alles wat de editor niet mag wijzigen (id,
 * organisatie, status, tijdstempels) en mét wat alleen in de browser bestaat:
 * de bron van elke scène — de blob-URL van de foto en hoe ver haar upload
 * staat. Bij het bewaren valt die bron weg (`toProjectPatch`), zodat er nooit
 * een blob-URL naar de server gaat.
 *
 * Alles hieronder is puur. De reducer in `state.ts` en de serveractie in
 * `actions.ts` rekenen daardoor met exact dezelfde functies.
 */

export const MIN_SCENE_SECONDS = 1;
export const MAX_SCENE_SECONDS = 15;
/** Stap van de duurregelaar; ook waar we op afronden. */
export const SCENE_SECONDS_STEP = 0.5;

export const MAX_SCENES = 40;

export type SceneSourceStatus = "klaar" | "uploaden" | "mislukt";

/**
 * Waar het beeld van een scène vandaan komt. Leeft alleen in dit tabblad:
 * een `previewUrl` is een blob-URL, en `progress` hoort bij een upload die
 * nu bezig is.
 */
export type SceneSource = {
  /** Id van de asset in de opslag, zodra de upload gelukt is. */
  assetId: ID | null;
  /** Id in de uploadlijst van dit tabblad; `null` voor scènes uit de databank. */
  uploadId: ID | null;
  fileName: string;
  previewUrl: string | null;
  status: SceneSourceStatus;
  /** 0 tot 100. */
  progress: number;
  error?: string;
};

export type EditorScene = Scene & { source: SceneSource };

export type EditorDocument = {
  title: string;
  aspectRatio: AspectRatio;
  templateId: ID | null;
  scenes: EditorScene[];
  branding: BrandingSettings;
  audio: AudioSettings;
  exportPresetIds: ID[];
};

/** Wat er van het document naar de server gaat. */
export type ProjectPatch = {
  title: string;
  aspectRatio: AspectRatio;
  templateId: ID | null;
  scenes: Scene[];
  branding: BrandingSettings;
  audio: AudioSettings;
  exportPresetIds: ID[];
  durationInSeconds: number;
};

export function createSceneId(): ID {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2);

  return `scn_${random.slice(0, 12)}`;
}

/** Afronden op een halve seconde en binnen de grenzen houden. */
export function clampSceneSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return MIN_SCENE_SECONDS;

  const stepped = Math.round(seconds / SCENE_SECONDS_STEP) * SCENE_SECONDS_STEP;

  return Math.min(Math.max(stepped, MIN_SCENE_SECONDS), MAX_SCENE_SECONDS);
}

export function createSceneSource(overrides: Partial<SceneSource> = {}): SceneSource {
  return {
    assetId: null,
    uploadId: null,
    fileName: "Foto",
    previewUrl: null,
    status: "klaar",
    progress: 100,
    ...overrides,
  };
}

export function createScene(options: {
  order: number;
  durationInSeconds: number;
  motion: SceneMotion;
  transition: TransitionId;
  source: SceneSource;
  id?: ID;
}): EditorScene {
  return {
    id: options.id ?? createSceneId(),
    order: options.order,
    assetId: options.source.assetId,
    durationInSeconds: clampSceneSeconds(options.durationInSeconds),
    motion: options.motion,
    transition: options.transition,
    captionTop: null,
    captionBottom: null,
    source: options.source,
  };
}

/**
 * Van opgeslagen project naar werkdocument.
 *
 * De foto's zelf staan nog niet in object storage (zie `project-store.ts`),
 * dus een scène uit de databank heeft geen voorbeeld. Dat is zichtbaar in de
 * lijst in plaats van verstopt: een grijs kader met de bestandsnaam is
 * eerlijker dan een lege plek.
 */
export function toEditorDocument(project: VideoProject): EditorDocument {
  const style = templateStyle(project.templateId);

  return {
    title: project.title,
    aspectRatio: project.aspectRatio,
    templateId: project.templateId ?? null,
    scenes: [...project.scenes]
      .sort((a, b) => a.order - b.order)
      .map((scene, index) => ({
        ...scene,
        order: index,
        durationInSeconds: clampSceneSeconds(scene.durationInSeconds),
        motion: normaliseMotion(scene.motion ?? style.motion),
        transition: scene.transition ?? style.transition,
        source: createSceneSource({
          assetId: scene.assetId ?? null,
          fileName: `Foto ${index + 1}`,
        }),
      })),
    branding: createBranding(project.branding),
    audio: clampAudio(createAudio(project.audio)),
    exportPresetIds: [...(project.exportPresetIds ?? [])],
  };
}

/** Van werkdocument naar wat er bewaard wordt. De bron blijft in de browser. */
export function toProjectPatch(document: EditorDocument): ProjectPatch {
  return {
    title: document.title.trim(),
    aspectRatio: document.aspectRatio,
    templateId: document.templateId,
    scenes: document.scenes.map((scene, index) => {
      const { source, ...rest } = scene;

      return {
        ...rest,
        order: index,
        // Zolang een upload loopt is er nog geen asset-id; de scène blijft
        // wél bestaan, zodat volgorde en instellingen niet verloren gaan.
        assetId: source.assetId,
        durationInSeconds: clampSceneSeconds(scene.durationInSeconds),
      };
    }),
    branding: document.branding,
    audio: clampAudio(document.audio),
    exportPresetIds: document.exportPresetIds,
    durationInSeconds: timelineDuration(document),
  };
}

export type TimelineSegmentKind = "intro" | "scene" | "outro";

export type TimelineSegment = {
  id: ID;
  kind: TimelineSegmentKind;
  /** `null` voor intro en outro: die horen bij het template, niet bij een foto. */
  sceneId: ID | null;
  label: string;
  startInSeconds: number;
  durationInSeconds: number;
};

export type Timeline = {
  segments: TimelineSegment[];
  durationInSeconds: number;
};

/**
 * De tijdlijn zoals ze gerenderd wordt: intro, de scènes, en een slotkaart als
 * de huisstijl er een vraagt. Overgangen overlappen twee blokken, dus elke
 * overgang maakt de video korter — precies wat `xfade` straks doet.
 */
export function buildTimeline(document: EditorDocument): Timeline {
  const style = templateStyle(document.templateId);
  const blocks: Omit<TimelineSegment, "startInSeconds">[] = [];

  if (style.introSeconds > 0) {
    blocks.push({
      id: "seg_intro",
      kind: "intro",
      sceneId: null,
      label: "Intro",
      durationInSeconds: style.introSeconds,
    });
  }

  for (const [index, scene] of document.scenes.entries()) {
    blocks.push({
      id: `seg_${scene.id}`,
      kind: "scene",
      sceneId: scene.id,
      label: `Scène ${index + 1}`,
      durationInSeconds: scene.durationInSeconds,
    });
  }

  if (document.branding.showContactCard && style.outroSeconds > 0) {
    blocks.push({
      id: "seg_outro",
      kind: "outro",
      sceneId: null,
      label: "Contact",
      durationInSeconds: style.outroSeconds,
    });
  }

  const overlap = getTransition(projectTransition(document) ?? style.transition).durationInSeconds;
  const segments: TimelineSegment[] = [];
  let cursor = 0;

  for (const [index, block] of blocks.entries()) {
    // Elk blok behalve het eerste begint iets vroeger: het loopt over het
    // vorige heen zolang de overgang duurt.
    const start = index === 0 ? 0 : Math.max(cursor - overlap, 0);

    segments.push({ ...block, startInSeconds: start });
    cursor = start + block.durationInSeconds;
  }

  return { segments, durationInSeconds: Math.max(cursor, 0) };
}

export function timelineDuration(document: EditorDocument): number {
  return Math.round(buildTimeline(document).durationInSeconds * 10) / 10;
}

/** De som van de scènes zelf, zonder intro, outro of overgangen. */
export function scenesDuration(document: EditorDocument): number {
  return document.scenes.reduce((total, scene) => total + scene.durationInSeconds, 0);
}

/**
 * De overgang van het project: die van de scènes als ze het eens zijn,
 * anders `null` ("gemengd"). Zo hoeft er geen tweede waarde bewaard te worden
 * die met de scènes uit de pas kan lopen.
 */
export function projectTransition(document: EditorDocument): TransitionId | null {
  const [first, ...rest] = document.scenes;
  if (!first?.transition) return null;

  const transition = first.transition as TransitionId;

  return rest.every((scene) => scene.transition === transition) ? transition : null;
}

export function findScene(document: EditorDocument, sceneId: ID | null): EditorScene | null {
  if (!sceneId) return null;

  return document.scenes.find((scene) => scene.id === sceneId) ?? null;
}

/** Welke scène er op dit moment in beeld is, en hoever ze staat (0 tot 1). */
export function sceneAt(
  timeline: Timeline,
  timeInSeconds: number,
): { segment: TimelineSegment | null; progress: number } {
  const segment =
    [...timeline.segments]
      .reverse()
      .find((candidate) => timeInSeconds >= candidate.startInSeconds) ??
    timeline.segments[0] ??
    null;

  if (!segment) return { segment: null, progress: 0 };

  const elapsed = timeInSeconds - segment.startInSeconds;
  const progress =
    segment.durationInSeconds > 0 ? Math.min(elapsed / segment.durationInSeconds, 1) : 0;

  return { segment, progress: Math.max(progress, 0) };
}
