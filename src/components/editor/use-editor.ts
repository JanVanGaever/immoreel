"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useUploads, type UploadsController } from "@/components/upload/use-uploads";
import { useAutosave, type AutosaveController } from "@/components/editor/use-autosave";
import { saveProjectAction } from "@/lib/editor/actions";
import {
  buildTimeline,
  findScene,
  toProjectPatch,
  type EditorDocument,
  type EditorScene,
  type Timeline,
} from "@/lib/editor/document";
import {
  createEditorReducer,
  createEditorState,
  targetSceneIds,
  type EditorAction,
  type EditorState,
  type SelectMode,
} from "@/lib/editor/state";
import { templateStyle, type TemplateStyle, type TransitionId } from "@/lib/editor/templates";
import { API_ROUTES } from "@/lib/constants";
import { createXhrTransport, type UploadTransport } from "@/lib/uploads/transport";
import type {
  AspectRatio,
  AudioSettings,
  BrandingSettings,
  ExportPlatform,
  ID,
  SceneMotion,
  Template,
} from "@/types";

/**
 * De editor in één hook.
 *
 * Hier komen de drie bronnen samen: de staat (`createEditorReducer`), de
 * uploads (`useUploads`) en het bewaren (`useAutosave`). De panelen krijgen
 * alleen deze controller en hoeven van die drie niets te weten.
 *
 * De koppeling tussen uploads en tijdlijn loopt maar één kant op: een upload
 * wordt een scène, nooit omgekeerd. Verwijderen gebeurt hier — eerst de
 * upload afbreken, dan de scène weg — zodat er geen twee lijsten zijn die
 * elkaar proberen bij te houden.
 */

export type UseEditorOptions = {
  projectId: ID;
  initialDocument: EditorDocument;
  templates: Template[];
  /**
   * Waar geüploade foto's heen gaan. Standaard naar de assetroute van dit
   * project; meegeven doe je alleen om die te vervangen, bijvoorbeeld in een
   * test. Bewust een standaard en geen verplichte prop: een editor die per
   * ongeluk zonder transport gebouwd wordt, is een editor waarin foto's
   * verdwijnen zonder dat iemand het merkt.
   */
  transport?: UploadTransport;
};

export type EditorController = {
  projectId: ID;
  state: EditorState;
  document: EditorDocument;
  scenes: EditorScene[];
  activeScene: EditorScene | null;
  selectedScenes: EditorScene[];
  /** Waar een bewerking op werkt: de selectie, of anders de open scène. */
  targetIds: ID[];
  isBulk: boolean;
  timeline: Timeline;
  durationInSeconds: number;
  templates: Template[];
  template: Template | null;
  style: TemplateStyle;
  uploads: UploadsController;
  save: AutosaveController;
  dispatch: (action: EditorAction) => void;

  setTitle: (title: string) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  chooseTemplate: (templateId: ID) => void;
  applyTemplateStyle: () => void;
  setTransition: (transition: TransitionId, sceneIds?: ID[]) => void;
  updateBranding: (changes: Partial<BrandingSettings>) => void;
  /** Alle afwijkingen wissen: het project volgt de huisstijl weer volledig. */
  resetBrandOverrides: () => void;
  updateAudio: (changes: Partial<AudioSettings>) => void;
  toggleExportPreset: (presetId: ID) => void;
  /** Alle formaten van één platform tegelijk aan- of uitzetten. */
  toggleExportPlatform: (platform: ExportPlatform, on: boolean) => void;
  /** De hele exportselectie vervangen; gebruikt door de snelkeuzes. */
  setExportPresets: (presetIds: ID[]) => void;

  selectScene: (sceneId: ID, mode?: SelectMode) => void;
  selectAll: () => void;
  clearSelection: () => void;

  addFiles: (files: File[]) => void;
  removeScenes: (sceneIds: ID[]) => void;
  moveScene: (sceneId: ID, offset: number) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  retryScene: (sceneId: ID) => void;

  setDuration: (seconds: number, sceneIds?: ID[]) => void;
  nudgeDuration: (delta: number, sceneIds?: ID[]) => void;
  spreadDuration: (totalSeconds: number, sceneIds?: ID[]) => void;
  updateMotion: (changes: Partial<SceneMotion>, sceneIds?: ID[]) => void;
  setCaption: (sceneId: ID, positie: "boven" | "onder", tekst: string) => void;
};

export function useEditor({
  projectId,
  initialDocument,
  templates,
  transport,
}: UseEditorOptions): EditorController {
  const reducer = useMemo(() => createEditorReducer(templates), [templates]);
  const [state, dispatch] = useReducer(reducer, initialDocument, createEditorState);

  // `scenes: "none"`: de scène is hier al gemaakt op het moment dat de foto in
  // de sleepzone viel, dus de route hoeft er geen tweede achteraan te hangen.
  // Zie `uploadProjectAssets()` — één eigenaar van de tijdlijn, en dat is deze.
  const defaultTransport = useMemo(
    () => createXhrTransport({ endpoint: API_ROUTES.projectAssets(projectId, { scenes: "none" }) }),
    [projectId],
  );

  const uploads = useUploads({ transport: transport ?? defaultTransport });

  // Uploads worden scènes. Eén effect, één richting.
  useEffect(() => {
    if (uploads.assets.length === 0) return;

    dispatch({ type: "uploads-gesynchroniseerd", assets: uploads.assets });
  }, [uploads.assets]);

  const document = state.document;
  const timeline = useMemo(() => buildTimeline(document), [document]);

  const save = useAutosave({
    value: document,
    save: useCallback(
      async (value: EditorDocument) => {
        const result = await saveProjectAction(projectId, toProjectPatch(value));

        return result.status === "opgeslagen"
          ? { ok: true, savedAt: result.savedAt }
          : { ok: false, message: result.message };
      },
      [projectId],
    ),
  });

  const targetIds = targetSceneIds(state);
  const targetsRef = useRef(targetIds);
  useEffect(() => {
    targetsRef.current = targetIds;
  });

  /** Zonder expliciete scènes werkt een bewerking op de selectie. */
  const resolve = useCallback((sceneIds?: ID[]) => sceneIds ?? targetsRef.current, []);

  const removeScenes = useCallback(
    (sceneIds: ID[]) => {
      // Eerst de upload: die breekt af en geeft zijn blob-URL vrij. Daarna pas
      // de scène, zodat de synchronisatie hierboven niets terug kan zetten.
      for (const sceneId of sceneIds) {
        const scene = findScene(document, sceneId);
        if (scene?.source.uploadId) uploads.remove(scene.source.uploadId);
      }

      dispatch({ type: "scenes-verwijderd", sceneIds });
    },
    [document, uploads],
  );

  const retryScene = useCallback(
    (sceneId: ID) => {
      const scene = findScene(document, sceneId);
      if (scene?.source.uploadId) uploads.retry(scene.source.uploadId);
    },
    [document, uploads],
  );

  const activeScene = findScene(document, state.activeSceneId);
  const selectedScenes = document.scenes.filter((scene) =>
    state.selectedSceneIds.includes(scene.id),
  );

  return {
    projectId,
    state,
    document,
    scenes: document.scenes,
    activeScene,
    selectedScenes,
    targetIds,
    isBulk: state.selectedSceneIds.length > 1,
    timeline,
    durationInSeconds: timeline.durationInSeconds,
    templates,
    template: templates.find((item) => item.id === document.templateId) ?? null,
    style: templateStyle(document.templateId),
    uploads,
    save,
    dispatch,

    setTitle: (title) => dispatch({ type: "titel-gewijzigd", title }),
    setAspectRatio: (aspectRatio) => dispatch({ type: "beeldverhouding-gekozen", aspectRatio }),
    chooseTemplate: (templateId) => dispatch({ type: "template-gekozen", templateId }),
    applyTemplateStyle: () => dispatch({ type: "templatestijl-toegepast" }),
    setTransition: (transition, sceneIds) =>
      dispatch({ type: "overgang-gekozen", transition, sceneIds }),
    updateBranding: (changes) => dispatch({ type: "branding-gewijzigd", changes }),
    resetBrandOverrides: () => dispatch({ type: "huisstijl-hersteld" }),
    updateAudio: (changes) => dispatch({ type: "audio-gewijzigd", changes }),
    toggleExportPreset: (presetId) => dispatch({ type: "exportpreset-getoggeld", presetId }),
    toggleExportPlatform: (platform, on) =>
      dispatch({ type: "exportplatform-getoggeld", platform, on }),
    setExportPresets: (presetIds) => dispatch({ type: "exportpresets-gezet", presetIds }),

    selectScene: (sceneId, mode = "vervang") =>
      dispatch({ type: "scene-geselecteerd", sceneId, mode }),
    selectAll: () => dispatch({ type: "alles-geselecteerd" }),
    clearSelection: () => dispatch({ type: "selectie-gewist" }),

    addFiles: (files) => uploads.add(files),
    removeScenes,
    moveScene: (sceneId, offset) => dispatch({ type: "scene-verplaatst", sceneId, offset }),
    reorderScenes: (fromIndex, toIndex) =>
      dispatch({ type: "scenes-hersorteerd", fromIndex, toIndex }),
    retryScene,

    setDuration: (seconds, sceneIds) =>
      dispatch({ type: "duur-gezet", sceneIds: resolve(sceneIds), seconds }),
    nudgeDuration: (delta, sceneIds) =>
      dispatch({ type: "duur-aangepast", sceneIds: resolve(sceneIds), delta }),
    spreadDuration: (totalSeconds, sceneIds) =>
      dispatch({ type: "duur-verdeeld", sceneIds: resolve(sceneIds), totalSeconds }),
    updateMotion: (changes, sceneIds) =>
      dispatch({ type: "motion-gewijzigd", sceneIds: resolve(sceneIds), changes }),
    setCaption: (sceneId, positie, tekst) =>
      dispatch({ type: "bijschrift-gewijzigd", sceneId, positie, tekst }),
  };
}

