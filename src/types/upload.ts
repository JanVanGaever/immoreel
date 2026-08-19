import type { ID } from "@/types/common";

/**
 * De vormen van de uploadflow. Ze staan los van `DraftPhoto` en `VideoProject`:
 * een upload is een bestand onderweg naar de opslag, en pas als dat gelukt is
 * wordt het een asset van een project.
 */

export type UploadStatus = "queued" | "uploading" | "done" | "error" | "canceled";

/**
 * Eén bestand in de uploadlijst. De volgorde van de array is de volgorde van
 * de assets — er staat bewust geen `position` in, zodat er maar één bron van
 * waarheid is. Gebruik `toUploadOrder()` om die volgorde naar de server te sturen.
 */
export type UploadAsset = {
  id: ID;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
  /**
   * Blob-URL van het bestand in dit tabblad, of de URL van de opslag bij een
   * asset die al op de server staat. `null` als er geen voorbeeld is.
   */
  previewUrl: string | null;
  status: UploadStatus;
  /** Percentage tussen 0 en 100. */
  progress: number;
  /** Waarom de upload mislukt is; alleen bij status `error`. */
  error?: string;
  /** Wat de backend teruggeeft zodra het bestand binnen is. */
  remoteId?: ID | null;
  /** Definitieve URL in de opslag, zodra de upload klaar is. */
  url?: string | null;
};

/** Een bestand dat niet eens in de lijst komt, met de reden erbij. */
export type UploadRejection = {
  fileName: string;
  reason: string;
};

/** Wat de server nodig heeft om de volgorde te bewaren. */
export type UploadOrderEntry = {
  assetId: ID;
  remoteId: ID | null;
  position: number;
};
