import type { ID, Timestamps } from "@/types/common";

/**
 * Renderjobs: het contract tussen de app, de wachtrij en de worker.
 *
 * Eén afspraak over taal: alles wat de gebruiker leest is Nederlands (zie
 * `src/lib/render/status.ts` voor de labels), maar de statussen, stappen en
 * foutcodes zelf zijn Engels. Ze zijn geen vastgoedtaal maar
 * infrastructuurtaal, en ze staan letterlijk zo in de logs, in Redis en in de
 * events die de frontend binnenkrijgt.
 */

/**
 * De levensloop van een job.
 *
 * `finalizing` is bewust een eigen status en niet de laatste procenten van
 * `processing`: op dat moment is het beeld klaar en loopt alleen het uploaden
 * nog. Dat is de fase waarin annuleren niets meer oplevert en waarin een
 * herstart het werk niet mag overdoen.
 */
export type RenderJobStatus = "queued" | "processing" | "finalizing" | "failed" | "done";

/** Statussen waarna er niets meer gebeurt zonder nieuwe opdracht. */
export type TerminalRenderJobStatus = Extract<RenderJobStatus, "failed" | "done">;

/**
 * De stappen van de pijplijn, in volgorde. Ze bepalen samen de voortgang: elke
 * stap heeft een gewicht (`src/lib/render/progress.ts`), zodat een percentage
 * iets betekent in plaats van gelijkmatig door te tikken.
 */
export type RenderStageId = "prepare" | "fetch" | "scenes" | "stitch" | "publish";

export type RenderErrorCode =
  | "project-missing"
  | "preset-missing"
  | "assets-missing"
  | "asset-download"
  | "ffmpeg"
  | "storage"
  | "timeout"
  | "cancelled"
  | "unknown";

export type RenderJobError = {
  code: RenderErrorCode;
  /** Wat de gebruiker te zien krijgt. Nederlands, zonder stacktrace. */
  message: string;
  /** Wat in de logs hoort: de oorspronkelijke foutmelding. */
  detail: string | null;
  stage: RenderStageId | null;
  /** Of het zin heeft dit nog eens te proberen. */
  retryable: boolean;
  at: string;
};

/**
 * Eén render van één project naar één exportpreset.
 *
 * De `id` is geen willekeurig getal maar wordt afgeleid uit project, preset en
 * `fingerprint` (zie `src/lib/render/fingerprint.ts`). Twee keer dezelfde
 * opdracht geeft dus dezelfde job: dat is wat het geheel idempotent maakt, van
 * de knop in de editor tot de rij in de databank.
 */
export type RenderJob = {
  id: ID;
  organisationId: ID;
  projectId: ID;
  presetId: ID;
  requestedBy: ID;
  /** Vingerafdruk van het renderplan; zelfde plan = zelfde job. */
  fingerprint: string;
  status: RenderJobStatus;
  stage: RenderStageId | null;
  /** 0 tot 100. Loopt nooit terug, ook niet na een nieuwe poging. */
  progress: number;
  /** Hoeveel keer een worker eraan begonnen is. */
  attempt: number;
  /**
   * Welke worker de job nu vasthoudt. Alleen die mag nog schrijven; een oudere
   * poging die alsnog terugkomt (stalled, dubbele levering) wordt genegeerd.
   */
  leaseId: string | null;
  /** Vaste sleutel in de opslag, zodat een nieuwe poging overschrijft. */
  outputKey: string | null;
  outputUrl: string | null;
  posterUrl: string | null;
  durationInSeconds: number | null;
  sizeInBytes: number | null;
  error: RenderJobError | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
} & Timestamps;

/**
 * Wat de frontend krijgt bij het pollen én in de eventstroom. Bewust smaller
 * dan `RenderJob`: geen lease, geen opslagsleutels, wel alles om een
 * voortgangsbalk te tekenen.
 */
export type RenderJobSnapshot = {
  jobId: ID;
  projectId: ID;
  presetId: ID;
  status: RenderJobStatus;
  stage: RenderStageId | null;
  progress: number;
  /** Nederlandse zin bij de huidige stap: "Scènes renderen". */
  message: string;
  outputUrl: string | null;
  posterUrl: string | null;
  /**
   * Wat het bestand weegt en hoe lang het duurt, zoals gemeten na het renderen.
   * Beide blijven `null` tot de job klaar is: zolang er geëncodeerd wordt is
   * elk cijfer hier een gok, en de downloadpagina toont liever niets dan een
   * grootte die straks niet klopt.
   */
  sizeInBytes: number | null;
  durationInSeconds: number | null;
  error: { code: RenderErrorCode; message: string; retryable: boolean } | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

/**
 * Wat de worker in de voortgang van de job zet. Dit reist via Redis mee met het
 * `progress`-event, zodat een browser die meeluistert niets uit de databank
 * hoeft te halen.
 */
export type RenderProgressEvent = {
  jobId: ID;
  projectId: ID;
  status: RenderJobStatus;
  stage: RenderStageId | null;
  progress: number;
  message: string;
  at: string;
};
