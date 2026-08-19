import { createEmptyDraft, isDraftEmpty } from "@/lib/new-project/draft";
import { isProjectGoal } from "@/lib/new-project/presets";
import type { AspectRatio, ProjectDraft } from "@/types";

/**
 * Concepten bewaren zonder server. De wizard schrijft na elke wijziging naar
 * `localStorage`, zodat een verkeerd gesloten tabblad of een herlaadbeurt geen
 * werk kost. Pas in de laatste stap gaat er iets naar de server.
 *
 * De opslag is hier een externe bron in de zin van `useSyncExternalStore`:
 * `subscribeToStoredDraft` + `readRawDraft` geven een stabiele momentopname,
 * zodat componenten hem kunnen lezen zonder state in een effect te zetten.
 *
 * Foto's gaan bewust niet mee: hun preview is een blob-URL die na het sluiten
 * van het tabblad niets meer voorstelt. We onthouden alleen hoeveel het er
 * waren, zodat de wizard eerlijk kan zeggen dat ze opnieuw toegevoegd moeten
 * worden. Zodra er object storage is, verhuist dit naar een echte upload.
 */

const STORAGE_KEY = "immoreel.new-project-draft";
const STORAGE_VERSION = 1;

const ASPECT_RATIOS: readonly AspectRatio[] = ["16:9", "9:16", "1:1", "4:5"];

type StoredPayload = {
  version: number;
  draft: Omit<ProjectDraft, "photos">;
  photoCount: number;
};

export type StoredDraft = {
  draft: ProjectDraft;
  /** Hoeveel foto's er in het bewaarde concept zaten. */
  photoCount: number;
};

/** Luisteraars binnen dit tabblad; het `storage`-event gaat alleen naar de andere. */
const listeners = new Set<() => void>();

function storage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    // Privémodus of geblokkeerde opslag: de wizard werkt gewoon door,
    // alleen zonder concept te bewaren.
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Voor `useSyncExternalStore`: dezelfde string zolang er niets verandert. */
export function readRawDraft(): string | null {
  return storage()?.getItem(STORAGE_KEY) ?? null;
}

export function subscribeToStoredDraft(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Ruwe opslag omzetten naar een concept. Alles wat niet klopt, valt weg. */
export function parseStoredDraft(raw: string | null): StoredDraft | null {
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as Partial<StoredPayload>;
    if (payload.version !== STORAGE_VERSION || !payload.draft) return null;

    const stored = payload.draft;
    const draft: ProjectDraft = {
      ...createEmptyDraft(),
      title: typeof stored.title === "string" ? stored.title : "",
      goal: isProjectGoal(stored.goal) ? stored.goal : null,
      aspectRatio: ASPECT_RATIOS.includes(stored.aspectRatio as AspectRatio)
        ? (stored.aspectRatio as AspectRatio)
        : null,
      templateId: typeof stored.templateId === "string" ? stored.templateId : null,
      choseAspectRatio: stored.choseAspectRatio === true,
      choseTemplate: stored.choseTemplate === true,
      updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : new Date().toISOString(),
    };

    if (isDraftEmpty(draft)) return null;

    return { draft, photoCount: typeof payload.photoCount === "number" ? payload.photoCount : 0 };
  } catch {
    // Onleesbaar concept (oude versie, handmatig aangepast): weg ermee.
    clearStoredDraft();
    return null;
  }
}

export function readStoredDraft(): StoredDraft | null {
  return parseStoredDraft(readRawDraft());
}

export function writeStoredDraft(draft: ProjectDraft): void {
  const store = storage();
  if (!store) return;

  if (isDraftEmpty(draft)) {
    clearStoredDraft();
    return;
  }

  const { photos, ...rest } = draft;
  const payload: StoredPayload = {
    version: STORAGE_VERSION,
    draft: rest,
    photoCount: photos.length,
  };

  try {
    store.setItem(STORAGE_KEY, JSON.stringify(payload));
    notify();
  } catch {
    // Opslag vol of geweigerd; niet erg genoeg om de wizard te onderbreken.
  }
}

export function clearStoredDraft(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
    notify();
  } catch {
    // Zie hierboven.
  }
}
