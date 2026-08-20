import { clampAudio, createAudio } from "@/lib/editor/audio";
import { createBranding } from "@/lib/editor/branding";
import {
  createSceneId,
  createSceneSource,
  toEditorDocument,
  toProjectPatch,
  type EditorScene,
  type ProjectPatch,
} from "@/lib/editor/document";
import { normaliseMotion } from "@/lib/editor/motion";
import { secondsPerPhotoFor } from "@/lib/new-project/draft";
import type {
  AspectRatio,
  AudioSettings,
  BrandKit,
  BrandingSettings,
  ID,
  SceneMotion,
  VideoProject,
} from "@/types";

/**
 * Van een deelwijziging naar een volledig bewaarverzoek.
 *
 * De API laat een client één ding wijzigen — een titel, een volgorde, het
 * volume — terwijl de store een compleet project bewaart. Ergens moet dat
 * verschil overbrugd worden, en de vraag is alleen wáár: in elke route apart
 * (en dan doet elke route het net iets anders) of hier.
 *
 * Het gaat bewust langs het editordocument. Dat kost een omweg, maar het levert
 * op dat een titel die via de API verandert precies dezelfde weg aflegt als een
 * titel die in de editor verandert: dezelfde normalisatie van scènes, dezelfde
 * berekening van de duur. `toProjectPatch()` rekent de tijdlijn opnieuw uit —
 * inclusief intro, slotkaart en de overlap van de overgangen — dus een duur die
 * een client zelf meestuurt, wordt genegeerd. Die is van ons.
 *
 * Puur rekenwerk: geen store, geen sessie. Wie het resultaat bewaart, staat in
 * `service.ts`.
 */

/**
 * Eén scène zoals ze binnenkomt.
 *
 * Alles is optioneel behalve niets: wie een scène meestuurt die al bestaat,
 * hoeft alleen te zeggen wat er verandert. Dat is geen luxe maar wat de
 * herschikroute nodig heeft — een volgorde bewaren mag geen beweging, duur of
 * bijschrift wissen omdat de client die velden niet bij de hand had.
 */
export type SceneInput = {
  /** Ontbreekt bij een nieuwe scène; dan maken we er een. */
  id?: ID;
  assetId?: ID | null;
  durationInSeconds?: number;
  motion?: Partial<SceneMotion>;
  transition?: string | null;
  captionTop?: string | null;
  captionBottom?: string | null;
};

export type ProjectChanges = {
  title?: string;
  aspectRatio?: AspectRatio;
  /** `null` betekent: geen template meer. Ontbreken betekent: laat staan. */
  templateId?: ID | null;
  /** De volledige tijdlijn, in de volgorde waarin ze straks staat. */
  scenes?: SceneInput[];
  /** Alleen de velden die meekomen; de rest blijft wat het was. */
  branding?: Partial<BrandingSettings>;
  audio?: Partial<AudioSettings>;
  exportPresetIds?: ID[];
};

export function mergeProjectPatch(
  project: VideoProject,
  brand: BrandKit,
  changes: ProjectChanges,
): ProjectPatch {
  const document = toEditorDocument(project, brand);
  const known = new Map(document.scenes.map((scene) => [scene.id, scene]));

  const scenes: EditorScene[] = changes.scenes
    ? changes.scenes.map((scene, index) =>
        toEditorScene(scene, index, scene.id ? known.get(scene.id) : undefined),
      )
    : document.scenes;

  return toProjectPatch({
    ...document,
    title: changes.title ?? document.title,
    aspectRatio: changes.aspectRatio ?? document.aspectRatio,
    // Hier telt het verschil tussen `null` en afwezig: het eerste haalt het
    // template weg, het tweede laat het staan.
    templateId: changes.templateId !== undefined ? changes.templateId : document.templateId,
    scenes,
    branding: changes.branding
      ? createBranding({ ...document.branding, ...changes.branding })
      : document.branding,
    audio: changes.audio
      ? clampAudio(createAudio({ ...document.audio, ...changes.audio }))
      : document.audio,
    exportPresetIds: changes.exportPresetIds ?? document.exportPresetIds,
  });
}

/**
 * Eén scène uit een verzoek als scène van het document.
 *
 * De `source` is wat alleen in een tabblad bestaat — een blob-URL, een upload
 * die loopt — en komt dus nooit van buiten. Wat er wél toe doet is `assetId`:
 * `toProjectPatch()` leest die uit de bron, dus die hoort hier ingevuld te
 * worden. De bestandsnaam van een scène die we al kenden blijft staan; anders
 * zou een herschikking elke foto hernoemen naar haar nieuwe plek.
 */
function toEditorScene(
  scene: SceneInput,
  index: number,
  previous: EditorScene | undefined,
): EditorScene {
  const assetId = scene.assetId !== undefined ? scene.assetId : (previous?.assetId ?? null);

  return {
    id: scene.id ?? createSceneId(),
    order: index,
    assetId,
    durationInSeconds:
      scene.durationInSeconds ?? previous?.durationInSeconds ?? secondsPerPhotoFor(null),
    // Wat de client van de beweging meestuurt, ligt over wat er al stond.
    motion: normaliseMotion({ ...previous?.motion, ...scene.motion }),
    transition: scene.transition !== undefined ? scene.transition : (previous?.transition ?? null),
    captionTop: scene.captionTop !== undefined ? scene.captionTop : (previous?.captionTop ?? null),
    captionBottom:
      scene.captionBottom !== undefined ? scene.captionBottom : (previous?.captionBottom ?? null),
    source: createSceneSource({
      assetId,
      fileName: previous?.source.fileName ?? `Foto ${index + 1}`,
    }),
  };
}
