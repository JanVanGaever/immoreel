import { clampAudio } from "@/lib/editor/audio";
import {
  clampSceneSeconds,
  createScene,
  createSceneSource,
  MAX_SCENES,
  type EditorDocument,
  type EditorScene,
  type SceneSource,
  type SceneSourceStatus,
} from "@/lib/editor/document";
import {
  normaliseExportPresetIds,
  setPlatformPresets,
  togglePresetId,
} from "@/lib/editor/export-presets";
import { createMotion, normaliseMotion } from "@/lib/editor/motion";
import { templateStyle, type TransitionId } from "@/lib/editor/templates";
import { resolveTemplateId } from "@/lib/new-project/draft";
import type {
  AspectRatio,
  AudioSettings,
  BrandingSettings,
  ExportPlatform,
  ID,
  SceneMotion,
  Template,
  UploadAsset,
} from "@/types";

/**
 * De staat van de editor als één pure reducer.
 *
 * Alles wat de gebruiker doet is hier een actie: bewerken, selecteren,
 * sorteren, bulk aanpassen. Twee dingen volgen daaruit en zijn de reden voor
 * deze opzet:
 *
 * - **Autosave is triviaal.** Het document is één waarde; verandert die, dan
 *   moet er bewaard worden. Geen component hoeft dat te melden.
 * - **Panelen blijven dom.** Een paneel toont staat en stuurt een actie. Een
 *   nieuw paneel toevoegen betekent dus geen nieuwe staat verspreiden.
 *
 * De selectie hoort er bewust bij: bulk edit is niets anders dan één actie die
 * op meerdere scènes tegelijk werkt, en dat is alleen mogelijk als de reducer
 * weet wat er geselecteerd is.
 */

export type EditorState = {
  document: EditorDocument;
  /** De scène in het rechterpaneel. */
  activeSceneId: ID | null;
  /** Aangevinkte scènes; bepaalt waar een bulkbewerking op werkt. */
  selectedSceneIds: ID[];
};

/** Hoe een klik op een scène de selectie verandert. */
export type SelectMode = "vervang" | "toevoegen" | "bereik";

export type EditorAction =
  | { type: "document-vervangen"; document: EditorDocument }
  | { type: "titel-gewijzigd"; title: string }
  | { type: "beeldverhouding-gekozen"; aspectRatio: AspectRatio }
  | { type: "template-gekozen"; templateId: ID }
  | { type: "templatestijl-toegepast" }
  | { type: "overgang-gekozen"; transition: TransitionId; sceneIds?: ID[] }
  | { type: "branding-gewijzigd"; changes: Partial<BrandingSettings> }
  | { type: "audio-gewijzigd"; changes: Partial<AudioSettings> }
  | { type: "exportpreset-getoggeld"; presetId: ID }
  /** Een heel platform in één keer aan- of uitzetten (alle formaten ervan). */
  | { type: "exportplatform-getoggeld"; platform: ExportPlatform; on: boolean }
  /** De hele selectie vervangen, bijvoorbeeld door "wat past bij dit project". */
  | { type: "exportpresets-gezet"; presetIds: ID[] }
  | { type: "uploads-gesynchroniseerd"; assets: UploadAsset[] }
  | { type: "scene-geselecteerd"; sceneId: ID; mode: SelectMode }
  | { type: "selectie-gezet"; sceneIds: ID[] }
  | { type: "alles-geselecteerd" }
  | { type: "selectie-gewist" }
  | { type: "scenes-verwijderd"; sceneIds: ID[] }
  | { type: "scene-verplaatst"; sceneId: ID; offset: number }
  | { type: "scenes-hersorteerd"; fromIndex: number; toIndex: number }
  | { type: "duur-gezet"; sceneIds: ID[]; seconds: number }
  | { type: "duur-aangepast"; sceneIds: ID[]; delta: number }
  | { type: "duur-verdeeld"; sceneIds: ID[]; totalSeconds: number }
  | { type: "motion-gewijzigd"; sceneIds: ID[]; changes: Partial<SceneMotion> }
  | { type: "bijschrift-gewijzigd"; sceneId: ID; positie: "boven" | "onder"; tekst: string };

export type EditorReducer = (state: EditorState, action: EditorAction) => EditorState;

export function createEditorState(document: EditorDocument): EditorState {
  const first = document.scenes[0]?.id ?? null;

  return { document, activeSceneId: first, selectedSceneIds: [] };
}

/**
 * Waar een bewerking op werkt: de aangevinkte scènes, of anders de scène die
 * open staat. Zo doet elke knop in het rechterpaneel automatisch aan bulk edit
 * zodra er iets geselecteerd is, zonder tweede set knoppen.
 */
export function targetSceneIds(state: EditorState): ID[] {
  if (state.selectedSceneIds.length > 0) return state.selectedSceneIds;

  return state.activeSceneId ? [state.activeSceneId] : [];
}

function withDocument(state: EditorState, changes: Partial<EditorDocument>): EditorState {
  return { ...state, document: { ...state.document, ...changes } };
}

/** Nummert opnieuw, zodat `order` altijd de plaats in de array is. */
function renumber(scenes: EditorScene[]): EditorScene[] {
  return scenes.map((scene, index) => (scene.order === index ? scene : { ...scene, order: index }));
}

function mapScenes(
  state: EditorState,
  sceneIds: ID[],
  update: (scene: EditorScene) => EditorScene,
): EditorState {
  if (sceneIds.length === 0) return state;

  const ids = new Set(sceneIds);

  return withDocument(state, {
    scenes: state.document.scenes.map((scene) => (ids.has(scene.id) ? update(scene) : scene)),
  });
}

const UPLOAD_STATUS: Record<UploadAsset["status"], SceneSourceStatus> = {
  queued: "uploaden",
  uploading: "uploaden",
  done: "klaar",
  error: "mislukt",
  canceled: "mislukt",
};

function toSource(asset: UploadAsset, previous?: SceneSource): SceneSource {
  return createSceneSource({
    assetId: asset.remoteId ?? previous?.assetId ?? null,
    uploadId: asset.id,
    fileName: asset.fileName,
    previewUrl: asset.url ?? asset.previewUrl ?? previous?.previewUrl ?? null,
    status: UPLOAD_STATUS[asset.status],
    progress: asset.status === "done" ? 100 : Math.round(asset.progress),
    error: asset.status === "canceled" ? "Geannuleerd." : asset.error,
  });
}

/**
 * Uploads worden scènes.
 *
 * Deze richting is de enige: de uploadlijst voegt toe en werkt bij, ze
 * verwijdert nooit. Verwijderen gebeurt in de editor, die daarna de upload
 * opruimt. Zonder die afspraak zouden lijst en tijdlijn elkaar in een lus
 * corrigeren.
 */
function syncUploads(state: EditorState, assets: UploadAsset[]): EditorState {
  const byUploadId = new Map(
    state.document.scenes
      .filter((scene) => scene.source.uploadId)
      .map((scene) => [scene.source.uploadId as ID, scene]),
  );

  const style = templateStyle(state.document.templateId);
  const scenes = [...state.document.scenes];
  let added: EditorScene | null = null;
  let changed = false;

  for (const asset of assets) {
    const existing = byUploadId.get(asset.id);

    if (existing) {
      const source = toSource(asset, existing.source);
      const index = scenes.indexOf(existing);
      const isSame =
        existing.source.status === source.status &&
        existing.source.progress === source.progress &&
        existing.source.previewUrl === source.previewUrl &&
        existing.source.assetId === source.assetId &&
        existing.source.error === source.error;

      if (isSame) continue;

      scenes[index] = { ...existing, assetId: source.assetId, source };
      changed = true;
      continue;
    }

    if (scenes.length >= MAX_SCENES) continue;

    added = createScene({
      order: scenes.length,
      durationInSeconds: style.secondsPerPhoto,
      motion: createMotion(style.motion),
      transition: style.transition,
      source: toSource(asset),
    });
    scenes.push(added);
    changed = true;
  }

  if (!changed) return state;

  return {
    ...state,
    document: { ...state.document, scenes: renumber(scenes) },
    // Wie net een foto toevoegt, wil er meteen iets aan kunnen instellen.
    activeSceneId: added?.id ?? state.activeSceneId,
  };
}

function selectScene(state: EditorState, sceneId: ID, mode: SelectMode): EditorState {
  const ids = state.document.scenes.map((scene) => scene.id);

  if (mode === "toevoegen") {
    const selected = state.selectedSceneIds.includes(sceneId)
      ? state.selectedSceneIds.filter((id) => id !== sceneId)
      : [...state.selectedSceneIds, sceneId];

    return { ...state, activeSceneId: sceneId, selectedSceneIds: selected };
  }

  if (mode === "bereik" && state.activeSceneId) {
    const from = ids.indexOf(state.activeSceneId);
    const to = ids.indexOf(sceneId);

    if (from >= 0 && to >= 0) {
      const [start, end] = from <= to ? [from, to] : [to, from];

      return { ...state, activeSceneId: sceneId, selectedSceneIds: ids.slice(start, end + 1) };
    }
  }

  return { ...state, activeSceneId: sceneId, selectedSceneIds: [] };
}

function removeScenes(state: EditorState, sceneIds: ID[]): EditorState {
  const ids = new Set(sceneIds);
  const scenes = renumber(state.document.scenes.filter((scene) => !ids.has(scene.id)));
  const activeRemoved = state.activeSceneId !== null && ids.has(state.activeSceneId);

  return {
    document: { ...state.document, scenes },
    activeSceneId: activeRemoved ? (scenes[0]?.id ?? null) : state.activeSceneId,
    selectedSceneIds: state.selectedSceneIds.filter((id) => !ids.has(id)),
  };
}

function reorder(scenes: EditorScene[], fromIndex: number, toIndex: number): EditorScene[] {
  if (fromIndex === toIndex) return scenes;
  if (fromIndex < 0 || fromIndex >= scenes.length) return scenes;
  if (toIndex < 0 || toIndex >= scenes.length) return scenes;

  const next = [...scenes];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);

  return renumber(next);
}

/**
 * De reducer heeft de templatecatalogus nodig om te weten welk template bij
 * een beeldverhouding past. Die staat niet ín de staat: het is gegeven, geen
 * bewerkbare waarde.
 */
export function createEditorReducer(templates: Template[]): EditorReducer {
  return function editorReducer(state, action) {
    switch (action.type) {
      case "document-vervangen":
        return createEditorState(action.document);

      case "titel-gewijzigd":
        return withDocument(state, { title: action.title });

      case "beeldverhouding-gekozen": {
        // Een ander formaat kan het gekozen template ongeldig maken. Net als
        // in de wizard schuiven we dan naar het dichtstbijzijnde dat wél past,
        // in plaats van de gebruiker met een foutmelding op te zadelen.
        const templateId = resolveTemplateId(
          templates,
          state.document.templateId,
          action.aspectRatio,
        );

        return withDocument(state, { aspectRatio: action.aspectRatio, templateId });
      }

      case "template-gekozen":
        return withDocument(state, { templateId: action.templateId });

      case "templatestijl-toegepast": {
        // Bewust een aparte, expliciete actie: een template kiezen mag niet
        // ongemerkt de duur en beweging van elke scène overschrijven.
        const style = templateStyle(state.document.templateId);

        return withDocument(state, {
          scenes: state.document.scenes.map((scene) => ({
            ...scene,
            durationInSeconds: clampSceneSeconds(style.secondsPerPhoto),
            motion: createMotion(style.motion),
            transition: style.transition,
          })),
        });
      }

      case "overgang-gekozen": {
        const ids = action.sceneIds ?? state.document.scenes.map((scene) => scene.id);

        return mapScenes(state, ids, (scene) => ({ ...scene, transition: action.transition }));
      }

      case "branding-gewijzigd":
        return withDocument(state, {
          branding: { ...state.document.branding, ...action.changes },
        });

      case "audio-gewijzigd":
        return withDocument(state, {
          audio: clampAudio({ ...state.document.audio, ...action.changes }),
        });

      case "exportpreset-getoggeld":
        return withDocument(state, {
          exportPresetIds: togglePresetId(state.document.exportPresetIds, action.presetId),
        });

      case "exportplatform-getoggeld":
        return withDocument(state, {
          exportPresetIds: setPlatformPresets(
            state.document.exportPresetIds,
            action.platform,
            action.on,
          ),
        });

      case "exportpresets-gezet":
        return withDocument(state, {
          exportPresetIds: normaliseExportPresetIds(action.presetIds),
        });

      case "uploads-gesynchroniseerd":
        return syncUploads(state, action.assets);

      case "scene-geselecteerd":
        return selectScene(state, action.sceneId, action.mode);

      case "selectie-gezet":
        return { ...state, selectedSceneIds: action.sceneIds };

      case "alles-geselecteerd":
        return { ...state, selectedSceneIds: state.document.scenes.map((scene) => scene.id) };

      case "selectie-gewist":
        return { ...state, selectedSceneIds: [] };

      case "scenes-verwijderd":
        return removeScenes(state, action.sceneIds);

      case "scene-verplaatst": {
        const from = state.document.scenes.findIndex((scene) => scene.id === action.sceneId);
        if (from < 0) return state;

        return withDocument(state, {
          scenes: reorder(state.document.scenes, from, from + action.offset),
        });
      }

      case "scenes-hersorteerd":
        return withDocument(state, {
          scenes: reorder(state.document.scenes, action.fromIndex, action.toIndex),
        });

      case "duur-gezet":
        return mapScenes(state, action.sceneIds, (scene) => ({
          ...scene,
          durationInSeconds: clampSceneSeconds(action.seconds),
        }));

      case "duur-aangepast":
        return mapScenes(state, action.sceneIds, (scene) => ({
          ...scene,
          durationInSeconds: clampSceneSeconds(scene.durationInSeconds + action.delta),
        }));

      case "duur-verdeeld": {
        // "Deze video mag 30 seconden duren": de lengte gelijk verdelen over
        // de scènes is sneller dan er twaalf apart instellen.
        const count = action.sceneIds.length;
        if (count === 0) return state;

        return mapScenes(state, action.sceneIds, (scene) => ({
          ...scene,
          durationInSeconds: clampSceneSeconds(action.totalSeconds / count),
        }));
      }

      case "motion-gewijzigd":
        // Door `normaliseMotion` heen: een regelaar levert een getal, een
        // preset een volledige beweging, en beide horen binnen de grenzen te
        // blijven zonder dat het paneel dat hoeft te weten.
        return mapScenes(state, action.sceneIds, (scene) => ({
          ...scene,
          motion: normaliseMotion({ ...scene.motion, ...action.changes }),
        }));

      case "bijschrift-gewijzigd": {
        const tekst = action.tekst.trim() === "" ? null : action.tekst;

        return mapScenes(state, [action.sceneId], (scene) =>
          action.positie === "boven"
            ? { ...scene, captionTop: tekst }
            : { ...scene, captionBottom: tekst },
        );
      }
    }
  };
}
