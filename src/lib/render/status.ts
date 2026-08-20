import type {
  ProjectStatus,
  RenderJob,
  RenderJobSnapshot,
  RenderJobStatus,
  RenderStageId,
} from "@/types";

/**
 * Eén bron van waarheid voor wat een jobstatus betekent, net zoals
 * `src/lib/project-status.ts` dat voor projecten doet.
 *
 * Hier staan ook de toegestane overgangen. Dat is geen formaliteit: met
 * meerdere workers en een wachtrij die opnieuw levert, komen updates soms in
 * de verkeerde volgorde binnen. Een job die al `done` is mag niet terugvallen
 * naar `processing` omdat een trage voortgangsmelding nog onderweg was.
 */

export const RENDER_JOB_STATUS_ORDER: readonly RenderJobStatus[] = [
  "queued",
  "processing",
  "finalizing",
  "done",
  "failed",
];

export const RENDER_JOB_STATUS_LABELS: Record<RenderJobStatus, string> = {
  queued: "In wachtrij",
  processing: "Renderen",
  finalizing: "Afwerken",
  failed: "Mislukt",
  done: "Klaar",
};

export const RENDER_STAGE_LABELS: Record<RenderStageId, string> = {
  prepare: "Renderplan opbouwen",
  fetch: "Foto's ophalen",
  scenes: "Scènes renderen",
  stitch: "Montage en geluid",
  publish: "Video wegschrijven",
};

/** Welke status hoort bij welke stap; de worker leidt de status hieruit af. */
const STATUS_BY_STAGE: Record<RenderStageId, RenderJobStatus> = {
  prepare: "processing",
  fetch: "processing",
  scenes: "processing",
  stitch: "processing",
  // Het beeld is klaar, alleen het wegschrijven loopt nog.
  publish: "finalizing",
};

const ALLOWED_TRANSITIONS: Record<RenderJobStatus, readonly RenderJobStatus[]> = {
  // Terug naar `queued` gebeurt bij een nieuwe poging na een fout of een
  // worker die halverwege wegviel.
  queued: ["queued", "processing", "failed"],
  processing: ["processing", "finalizing", "failed", "queued"],
  finalizing: ["finalizing", "done", "failed", "queued"],
  failed: ["queued"],
  // Klaar is klaar. Een nieuwe render is een nieuwe job.
  done: [],
};

export function statusForStage(stage: RenderStageId): RenderJobStatus {
  return STATUS_BY_STAGE[stage];
}

export function isTerminalStatus(status: RenderJobStatus): boolean {
  return status === "done" || status === "failed";
}

export function canTransition(from: RenderJobStatus, to: RenderJobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Wat er in de projectlijst en op het dashboard moet staan zolang deze job loopt. */
export function toProjectStatus(status: RenderJobStatus): ProjectStatus {
  if (status === "queued") return "wachtrij";
  if (status === "failed") return "mislukt";
  if (status === "done") return "klaar";

  return "renderen";
}

/** De zin die bij de huidige stand hoort. */
export function describeProgress(status: RenderJobStatus, stage: RenderStageId | null): string {
  if (status === "queued") return "Wacht tot een worker vrij is.";
  if (status === "done") return "De video staat klaar.";
  if (status === "failed") return "De render is afgebroken.";

  return stage ? RENDER_STAGE_LABELS[stage] : RENDER_JOB_STATUS_LABELS[status];
}

/**
 * Wat de browser mag zien. Lease, opslagsleutel en de technische foutdetails
 * blijven bewust op de server.
 */
export function toRenderJobSnapshot(job: RenderJob): RenderJobSnapshot {
  return {
    jobId: job.id,
    projectId: job.projectId,
    presetId: job.presetId,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    message: describeProgress(job.status, job.stage),
    outputUrl: job.outputUrl,
    posterUrl: job.posterUrl,
    sizeInBytes: job.sizeInBytes,
    durationInSeconds: job.durationInSeconds,
    error: job.error
      ? { code: job.error.code, message: job.error.message, retryable: job.error.retryable }
      : null,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    updatedAt: job.updatedAt,
  };
}

/**
 * De status van het project, gegeven al zijn renderjobs.
 *
 * Een project exporteert vaak naar meerdere platformen tegelijk, en die jobs
 * lopen naast elkaar. Eén job die klaar is, betekent dus niet dat het project
 * klaar is; de volgorde hieronder zegt wat er in de lijst hoort te staan
 * zolang de rest nog loopt. Mislukt gaat vóór klaar: dat is de enige stand
 * waar de gebruiker iets mee moet.
 */
export function projectStatusForJobs(jobs: readonly RenderJob[]): ProjectStatus | null {
  if (jobs.length === 0) return null;

  if (jobs.some((job) => job.status === "processing" || job.status === "finalizing")) {
    return "renderen";
  }

  if (jobs.some((job) => job.status === "queued")) return "wachtrij";
  if (jobs.some((job) => job.status === "failed")) return "mislukt";
  if (jobs.some((job) => job.status === "done")) return "klaar";

  return null;
}
