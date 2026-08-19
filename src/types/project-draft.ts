import type { ID } from "@/types/common";
import type { AspectRatio } from "@/types/video";

/**
 * De vormen van de "Nieuw project"-wizard. Ze staan bewust náást
 * `VideoProject`: zolang de gebruiker in de wizard zit is er nog geen project,
 * alleen een concept. Pas in de laatste stap wordt daar een project van
 * gemaakt (zie `src/db/project-store.ts`).
 */

/** Waar de video voor gemaakt wordt. Bepaalt de standaardwaarden (preset). */
export type ProjectGoal = "website" | "linkedin" | "instagram" | "tiktok" | "whatsapp";

/**
 * Eén foto in het concept. `previewUrl` is een blob-URL: die leeft alleen in
 * het tabblad waar de foto gekozen is en gaat niet mee naar de server.
 */
export type DraftPhoto = {
  id: ID;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
  previewUrl?: string | null;
};

/** Alles wat de gebruiker in de wizard invult. */
export type ProjectDraft = {
  title: string;
  goal: ProjectGoal | null;
  aspectRatio: AspectRatio | null;
  templateId: ID | null;
  photos: DraftPhoto[];
  /**
   * Wat de gebruiker zelf koos. Een preset vult alleen in wat nog niet
   * handmatig gezet is, zodat een ander doel kiezen geen eigen keuze wist.
   */
  choseAspectRatio: boolean;
  choseTemplate: boolean;
  updatedAt: string;
};

/**
 * Wat de wizard oplevert en aan de server geeft. Alles is hier ingevuld:
 * een concept met gaten komt niet zover (zie `validateDraft`).
 */
export type NewProjectInput = {
  title: string;
  goal: ProjectGoal;
  aspectRatio: AspectRatio;
  templateId: ID;
  photos: DraftPhoto[];
  /** Uit de preset van het doel; bepaalt hoe lang elke scène in beeld blijft. */
  secondsPerPhoto: number;
};
