"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  addPhotos as addPhotosToDraft,
  applyGoal,
  createEmptyDraft,
  movePhoto as movePhotoInDraft,
  removePhoto as removePhotoFromDraft,
  setAspectRatio as setAspectRatioOnDraft,
  setTemplateId as setTemplateOnDraft,
  setTitle as setTitleOnDraft,
} from "@/lib/new-project/draft";
import {
  clearStoredDraft,
  parseStoredDraft,
  readRawDraft,
  subscribeToStoredDraft,
  writeStoredDraft,
} from "@/lib/new-project/draft-storage";
import { MAX_PHOTOS } from "@/lib/new-project/validation";
import { rejectionFor } from "@/lib/uploads/validation";
import type {
  AspectRatio,
  DraftPhoto,
  ID,
  ProjectDraft,
  ProjectGoal,
  Template,
  UploadRejection,
} from "@/types";

/** Hoe lang we wachten met bewaren nadat het typen stopt. */
const AUTOSAVE_DELAY_MS = 500;

/** Op de server is er geen opslag; daar bestaat er dus ook geen concept. */
const serverSnapshot = () => null;

/**
 * Dezelfde vorm als bij de uploadlijst, met de foutcode erbij. Stond hier eerst
 * als eigen type; dat betekende dat een bestand dat de wizard weigerde en
 * hetzelfde bestand dat de uploader weigerde, twee verschillende dingen waren.
 */
export type PhotoRejection = UploadRejection;

export type AddPhotosResult = { added: number; rejected: PhotoRejection[] };

/** Een eerder bewaard concept, zolang de gebruiker nog niets gewijzigd heeft. */
export type RestorableDraft = {
  title: string;
  updatedAt: string;
  photoCount: number;
};

export type ProjectDraftController = {
  draft: ProjectDraft;
  /** Bewaard concept dat klaarstaat om verder te werken; `null` als er geen is. */
  restorable: RestorableDraft | null;
  restore(): void;
  discardStored(): void;
  /** Aantal foto's in het teruggehaalde concept; `null` als er niets hersteld is. */
  restoredPhotoCount: number | null;
  /** Wanneer het concept voor het laatst bewaard is; `null` zolang er niets staat. */
  savedAt: string | null;
  setTitle(title: string): void;
  chooseGoal(goal: ProjectGoal): void;
  chooseAspectRatio(ratio: AspectRatio): void;
  chooseTemplate(templateId: ID): void;
  addPhotos(files: File[]): AddPhotosResult;
  removePhoto(photoId: ID): void;
  movePhoto(photoId: ID, offset: number): void;
  /** Meteen bewaren, zonder te wachten op de autosave. */
  saveNow(): void;
  /** Concept weggooien en opnieuw beginnen. */
  reset(): void;
  /** Bewaard concept opruimen, nadat het project aangemaakt is. */
  forget(): void;
};

function createPhotoId(): ID {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2);

  return `pho_${random.slice(0, 12)}`;
}

function toDraftPhoto(file: File): DraftPhoto {
  return {
    id: createPhotoId(),
    fileName: file.name,
    mimeType: file.type,
    sizeInBytes: file.size,
    previewUrl: URL.createObjectURL(file),
  };
}

/**
 * De staat van het concept: de wijzigingen, het bewaren en het terughalen van
 * een eerder concept. De wizard zelf gaat daardoor alleen nog over schermen.
 *
 * De opslag lezen we via `useSyncExternalStore`, niet in een effect: op de
 * server bestaat er geen concept, en na de hydratie verschijnt het zonder dat
 * we state hoeven te synchroniseren. Het terughalen zelf blijft een klik van
 * de gebruiker — een concept dat ongevraagd terugkomt (mét ontbrekende foto's)
 * is verwarrender dan een banner die het aanbiedt.
 */
export function useProjectDraft(templates: Template[]): ProjectDraftController {
  const [draft, setDraft] = useState<ProjectDraft>(createEmptyDraft);
  /** Zodra de gebruiker iets wijzigt, is de wizard de bron en niet de opslag. */
  const [started, setStarted] = useState(false);
  const [restoredPhotoCount, setRestoredPhotoCount] = useState<number | null>(null);

  const previewUrls = useRef(new Set<string>());

  const raw = useSyncExternalStore(subscribeToStoredDraft, readRawDraft, serverSnapshot);
  const stored = useMemo(() => parseStoredDraft(raw), [raw]);

  const restorable: RestorableDraft | null =
    started || !stored
      ? null
      : {
          title: stored.draft.title.trim(),
          updatedAt: stored.draft.updatedAt,
          photoCount: stored.photoCount,
        };

  // Zolang de gebruiker bezig is, is wat er in de opslag staat precies wat
  // de autosave er net in geschreven heeft.
  const savedAt = started && stored ? stored.draft.updatedAt : null;

  const trackPreview = useCallback((photo: DraftPhoto) => {
    if (photo.previewUrl) previewUrls.current.add(photo.previewUrl);
  }, []);

  const releasePreview = useCallback((photo: DraftPhoto | undefined) => {
    if (!photo?.previewUrl) return;

    URL.revokeObjectURL(photo.previewUrl);
    previewUrls.current.delete(photo.previewUrl);
  }, []);

  // Automatisch bewaren, maar pas zodra de gebruiker iets gewijzigd heeft:
  // het lege concept van bij het openen zou anders het bewaarde overschrijven.
  useEffect(() => {
    if (!started) return;

    const timer = setTimeout(() => writeStoredDraft(draft), AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [draft, started]);

  // Blob-URL's vrijgeven wanneer de wizard verdwijnt.
  useEffect(() => {
    const urls = previewUrls.current;

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  /** Elke wijziging maakt de wizard leidend over de opslag. */
  const change = useCallback((update: (current: ProjectDraft) => ProjectDraft) => {
    setStarted(true);
    setDraft(update);
  }, []);

  const restore = useCallback(() => {
    if (!stored) return;

    setStarted(true);
    setDraft(stored.draft);
    setRestoredPhotoCount(stored.photoCount);
  }, [stored]);

  const discardStored = useCallback(() => {
    clearStoredDraft();
    setStarted(true);
  }, []);

  const setTitle = useCallback(
    (title: string) => change((current) => setTitleOnDraft(current, title)),
    [change],
  );

  const chooseGoal = useCallback(
    (goal: ProjectGoal) => change((current) => applyGoal(current, goal, templates)),
    [change, templates],
  );

  const chooseAspectRatio = useCallback(
    (ratio: AspectRatio) => change((current) => setAspectRatioOnDraft(current, ratio, templates)),
    [change, templates],
  );

  const chooseTemplate = useCallback(
    (templateId: ID) => change((current) => setTemplateOnDraft(current, templateId)),
    [change],
  );

  const addPhotos = useCallback(
    (files: File[]): AddPhotosResult => {
      const rejected: PhotoRejection[] = [];
      const accepted: File[] = [];

      for (const file of files) {
        const rejection = rejectionFor(file);
        if (rejection) {
          rejected.push(rejection);
          continue;
        }
        accepted.push(file);
      }

      let added = 0;

      change((current) => {
        const room = Math.max(MAX_PHOTOS - current.photos.length, 0);
        const fits = accepted.slice(0, room);

        for (const file of accepted.slice(room)) {
          rejected.push({
            fileName: file.name,
            code: "upload-rejected",
            reason: `Meer dan ${MAX_PHOTOS} foto's.`,
          });
        }

        if (fits.length === 0) return current;

        const photos = fits.map(toDraftPhoto);
        photos.forEach(trackPreview);
        added = photos.length;

        return addPhotosToDraft(current, photos);
      });

      return { added, rejected };
    },
    [change, trackPreview],
  );

  const removePhoto = useCallback(
    (photoId: ID) => {
      change((current) => {
        releasePreview(current.photos.find((photo) => photo.id === photoId));
        return removePhotoFromDraft(current, photoId);
      });
    },
    [change, releasePreview],
  );

  const movePhoto = useCallback(
    (photoId: ID, offset: number) => change((current) => movePhotoInDraft(current, photoId, offset)),
    [change],
  );

  /** Zonder wijziging valt er niets te bewaren — en blijft een ouder concept staan. */
  const saveNow = useCallback(() => {
    if (!started) return;

    writeStoredDraft(draft);
  }, [draft, started]);

  const reset = useCallback(() => {
    setDraft((current) => {
      current.photos.forEach(releasePreview);
      return createEmptyDraft();
    });
    clearStoredDraft();
    setStarted(true);
    setRestoredPhotoCount(null);
  }, [releasePreview]);

  const forget = useCallback(() => clearStoredDraft(), []);

  return {
    draft,
    restorable,
    restore,
    discardStored,
    restoredPhotoCount,
    savedAt,
    setTitle,
    chooseGoal,
    chooseAspectRatio,
    chooseTemplate,
    addPhotos,
    removePhoto,
    movePhoto,
    saveNow,
    reset,
    forget,
  };
}
