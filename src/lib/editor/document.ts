import { API_ROUTES } from "@/lib/constants";
import { clampAudio, createAudio } from "@/lib/editor/audio";
import { createBranding } from "@/lib/editor/branding";
import { normaliseExportPresetIds } from "@/lib/editor/export-presets";
import { normaliseMotion } from "@/lib/editor/motion";
import {
  getTransition,
  templateStyle,
  type TemplateStyle,
  type TransitionId,
} from "@/lib/editor/templates";
import type {
  AspectRatio,
  AudioSettings,
  BrandKit,
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
  /**
   * De huisstijl van het kantoor. Alleen om te lezen: die verander je op de
   * instellingenpagina, niet in de editor. Ze zit hier omdat elke preview haar
   * nodig heeft en niemand daarvoor de server wil bevragen.
   */
  brand: BrandKit;
  /** Waar dit project van de huisstijl afwijkt. */
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
 * De huisstijl komt er als tweede argument bij en niet uit het project: ze
 * hoort bij de organisatie, en wie een project laadt heeft haar sowieso al
 * moeten opvragen. Zo is er geen enkel pad waarlangs een editor zonder
 * huisstijl kan ontstaan.
 *
 * Een scène met een foto krijgt hier het adres van die foto mee. Dat is niet
 * altijd zo geweest, en het verschil is de moeite waard om te onthouden: zonder
 * dat adres tekende de editor alleen wat er in dít tabblad geüpload was. Wie
 * uit de wizard kwam of de pagina herlaadde, zag een tijdlijn met de juiste
 * scènes en lege kaders erin — de foto's stonden er wél, er was alleen niets
 * dat ernaar wees.
 *
 * Een scène zonder foto houdt `previewUrl: null` en blijft een grijs kader.
 * Dat is geen fout maar de neutrale stand: zo staan de demoprojecten in
 * `db/seed/projects.ts`, en zo ziet een upload eruit die halverwege afbrak.
 */
export function toEditorDocument(project: VideoProject, brand: BrandKit): EditorDocument {
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
        // `assetId: null` blijft hier bewust de neutrale stand en wordt geen
        // fout. Uit de bewaarde rij alleen is niet te zien of deze scène nooit
        // een foto had (zo staan de demoprojecten in `db/seed/projects.ts`, en
        // zo staat elk project van vóór de uploads erin) of dat een upload
        // halverwege afbrak. Alles rood kleuren maakt het eerste geval kapot om
        // het tweede te kunnen tonen. Wat de gebruiker ziet is een grijs kader
        // met de bestandsnaam — leeg, en dat is precies wat het is.
        //
        // Is er wél een foto, dan wijst `previewUrl` naar `/api/assets/:id`.
        // Geen blob-URL: die hoort bij één tabblad en is na een herlaadbeurt
        // niets meer waard. Dit adres overleeft dat, en de route erachter
        // controleert nog steeds of deze foto van dit kantoor is.
        source: createSceneSource({
          assetId: scene.assetId ?? null,
          fileName: `Foto ${index + 1}`,
          previewUrl: scene.assetId ? API_ROUTES.asset(scene.assetId) : null,
        }),
      })),
    brand,
    branding: createBranding(project.branding),
    audio: clampAudio(createAudio(project.audio)),
    // Een project uit de databank kan nog ids van vóór de huidige catalogus
    // bevatten; die worden hier hun opvolger in plaats van te verdwijnen.
    exportPresetIds: normaliseExportPresetIds(project.exportPresetIds),
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

  const segments: TimelineSegment[] = [];
  let cursor = 0;

  for (const [index, block] of blocks.entries()) {
    // Elk blok behalve het eerste begint iets vroeger: het loopt over het
    // vorige heen zolang de overgang duurt.
    //
    // De overgang komt van het blok zelf en niet van het project als geheel.
    // Dat is niet altijd zo geweest: er stond hier één overlap voor de hele
    // tijdlijn, en zodra twee scènes een verschillende overgang hadden viel dat
    // terug op die van het template. Wie in de editor één scène op "harde cut"
    // zette, zag daar niets van — niet in de tijdlijn, niet in de preview — en
    // kreeg wél een gerenderde video waarin het klopte. `buildRenderPlan()`
    // rekende namelijk altijd al per scène.
    const overlap = index === 0 ? 0 : overlapFor(block, document, style);

    const start = Math.max(cursor - overlap, 0);

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
/**
 * Hoe lang dit blok over het vorige heen loopt.
 *
 * Voor een scène is dat haar eigen overgang — precies de regel die
 * `buildRenderPlan()` hanteert, zodat de tijdlijn, de preview en de gerenderde
 * video het over dezelfde video hebben. De intro- en contactkaart hebben geen
 * scène en volgen het template.
 */
export function overlapFor(
  block: Pick<TimelineSegment, "kind" | "sceneId">,
  document: EditorDocument,
  style: TemplateStyle,
): number {
  const scene = block.sceneId ? findScene(document, block.sceneId) : null;
  const transition = (scene?.transition as TransitionId | null) ?? style.transition;

  return getTransition(transition).durationInSeconds;
}

/**
 * De overgang van het project, als alle scènes dezelfde hebben.
 *
 * Alleen nog om iets over het geheel te kúnnen zeggen — een keuzelijst die
 * "gemengd" moet tonen, bijvoorbeeld. Voor het bouwen van een tijdlijn of een
 * plan hoort dit níet gebruikt te worden: daar telt de overgang van elke scène
 * apart.
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
