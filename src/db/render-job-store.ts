import { canTransition, statusForStage } from "@/lib/render/status";
import { keepMonotonic } from "@/lib/render/progress";
import type { ID, RenderJob, RenderJobError, RenderStageId } from "@/types";

/**
 * Renderjobs achter één poort, zoals de auth-, dashboard- en projectstore.
 *
 * Twee dingen maken deze store anders dan de rest: er schrijven meerdere
 * processen tegelijk in, en dezelfde schrijfopdracht kan twee keer aankomen.
 * Daarom werkt alles hier met een *lease*. Wie een job claimt, krijgt een
 * leaseId; alleen updates met dat leaseId worden aangenomen. Een worker die na
 * een netwerkhapering terugkomt terwijl een andere worker de job al heeft
 * overgenomen, schrijft dus niets meer stuk — zijn updates worden stilletjes
 * genegeerd, en dat is precies de bedoeling.
 *
 * De implementatie hieronder houdt alles in het geheugen van het proces. Dat is
 * genoeg om de pijplijn te draaien, maar het betekent ook dat webserver en
 * worker elkaars jobs alleen zien als ze hetzelfde proces delen (zie
 * `RENDER_WORKER_INLINE` in `src/workers/README.md`). De databankversie schrijft
 * dezelfde regels als voorwaarden in de UPDATE zelf:
 *
 *   UPDATE render_jobs SET ... WHERE id = $1 AND lease_id = $2 AND status <> "done"
 *
 * Zolang die voorwaarden in de query staan, is de volgorde van gelijktijdige
 * updates niet meer ons probleem.
 */

export type CreateRenderJobInput = {
  /** Afgeleid uit project, preset en plan (`src/lib/render/fingerprint.ts`). */
  jobId: ID;
  organisationId: ID;
  projectId: ID;
  presetId: ID;
  requestedBy: ID;
  fingerprint: string;
};

export type RenderLease = {
  /** Uniek per poging. Wie deze niet heeft, mag niet meer schrijven. */
  leaseId: string;
  attempt: number;
};

export type ClaimResult =
  | { outcome: "claimed"; job: RenderJob }
  /** Al af. De worker mag stoppen en het bestaande resultaat teruggeven. */
  | { outcome: "already-done"; job: RenderJob }
  | { outcome: "missing"; job: null };

export type RenderProgressUpdate = {
  stage: RenderStageId;
  /** De fractie binnen de stap is al omgerekend; dit is het percentage over alles. */
  progress: number;
};

export type RenderJobResult = {
  outputKey: string | null;
  outputUrl: string | null;
  posterUrl: string | null;
  durationInSeconds: number | null;
  sizeInBytes: number | null;
};

export type RenderJobStore = {
  /** Bestaat de job al, dan komt die terug met `created: false`. */
  createOrGet(input: CreateRenderJobInput): Promise<{ job: RenderJob; created: boolean }>;
  find(jobId: ID): Promise<RenderJob | null>;
  findForOrganisation(organisationId: ID, jobId: ID): Promise<RenderJob | null>;
  listForProject(organisationId: ID, projectId: ID): Promise<RenderJob[]>;
  /** Neemt de job over. Geeft `already-done` als er niets meer te doen valt. */
  claim(jobId: ID, lease: RenderLease): Promise<ClaimResult>;
  /**
   * Een mislukte job opnieuw in de wachtrij zetten.
   *
   * Alleen de rij in de store; de job in Redis wordt apart opnieuw ingestuurd
   * (`enqueueRenderJob`). Zonder dit blijft de kaart op de downloadpagina op
   * "Mislukt" staan tot een worker de job effectief oppikt, en dat kan seconden
   * duren — precies de seconden waarin de gebruiker denkt dat zijn klik niets
   * gedaan heeft.
   */
  requeue(organisationId: ID, jobId: ID): Promise<RenderJob | null>;
  /** Voortgang. Geeft `null` als de lease niet meer geldig is. */
  report(jobId: ID, leaseId: string, update: RenderProgressUpdate): Promise<RenderJob | null>;
  finish(jobId: ID, leaseId: string, result: RenderJobResult): Promise<RenderJob | null>;
  /**
   * Fout. Met `willRetry` gaat de job terug naar `queued` — de wachtrij doet
   * nog een poging — zonder gaat ze naar `failed` en is ze afgesloten.
   */
  fail(
    jobId: ID,
    leaseId: string,
    error: RenderJobError,
    options: { willRetry: boolean },
  ): Promise<RenderJob | null>;
};

declare global {
  var __immoreelRenderJobs: Map<ID, RenderJob> | undefined;
}

function getData(): Map<ID, RenderJob> {
  globalThis.__immoreelRenderJobs ??= new Map();

  return globalThis.__immoreelRenderJobs;
}

/** Alleen de houder van de lease mag schrijven; een lege lease hoort bij niemand. */
function holdsLease(job: RenderJob, leaseId: string): boolean {
  return job.leaseId !== null && job.leaseId === leaseId;
}

const memoryStore: RenderJobStore = {
  async createOrGet(input) {
    const existing = getData().get(input.jobId);
    if (existing) return { job: existing, created: false };

    const now = new Date().toISOString();
    const job: RenderJob = {
      id: input.jobId,
      organisationId: input.organisationId,
      projectId: input.projectId,
      presetId: input.presetId,
      requestedBy: input.requestedBy,
      fingerprint: input.fingerprint,
      status: "queued",
      stage: null,
      progress: 0,
      attempt: 0,
      leaseId: null,
      outputKey: null,
      outputUrl: null,
      posterUrl: null,
      durationInSeconds: null,
      sizeInBytes: null,
      error: null,
      queuedAt: now,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    getData().set(job.id, job);

    return { job, created: true };
  },

  async find(jobId) {
    return getData().get(jobId) ?? null;
  },

  async findForOrganisation(organisationId, jobId) {
    const job = getData().get(jobId);
    if (!job || job.organisationId !== organisationId) return null;

    return job;
  },

  async listForProject(organisationId, projectId) {
    return [...getData().values()]
      .filter((job) => job.organisationId === organisationId && job.projectId === projectId)
      .sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));
  },

  async claim(jobId, lease) {
    const job = getData().get(jobId);
    if (!job) return { outcome: "missing", job: null };

    // Klaar is klaar: een tweede levering van dezelfde job rendert niets opnieuw.
    if (job.status === "done") return { outcome: "already-done", job };

    const now = new Date().toISOString();
    const claimed: RenderJob = {
      ...job,
      status: "processing",
      stage: "prepare",
      attempt: lease.attempt,
      leaseId: lease.leaseId,
      // De vorige poging is voorbij; haar fout blijft niet als waarschuwing staan.
      error: null,
      startedAt: job.startedAt ?? now,
      finishedAt: null,
      updatedAt: now,
    };

    getData().set(jobId, claimed);

    return { outcome: "claimed", job: claimed };
  },

  async requeue(organisationId, jobId) {
    const job = getData().get(jobId);
    if (!job || job.organisationId !== organisationId) return null;
    if (!canTransition(job.status, "queued")) return null;

    const now = new Date().toISOString();
    const updated: RenderJob = {
      ...job,
      status: "queued",
      stage: null,
      // De lease van de vorige poging is niets meer waard; wie claimt, krijgt
      // een nieuwe. De fout blijft staan tot dat gebeurt: verdwijnt ze nu al,
      // dan is er geen spoor meer van waarom er opnieuw geprobeerd wordt.
      leaseId: null,
      // `progress` blijft staan: hij loopt nooit terug (zie `RenderJob`).
      finishedAt: null,
      queuedAt: now,
      updatedAt: now,
    };

    getData().set(jobId, updated);

    return updated;
  },

  async report(jobId, leaseId, update) {
    const job = getData().get(jobId);
    if (!job || !holdsLease(job, leaseId)) return null;

    const status = statusForStage(update.stage);
    if (!canTransition(job.status, status)) return null;

    const updated: RenderJob = {
      ...job,
      status,
      stage: update.stage,
      progress: keepMonotonic(job.progress, update.progress),
      updatedAt: new Date().toISOString(),
    };

    getData().set(jobId, updated);

    return updated;
  },

  async finish(jobId, leaseId, result) {
    const job = getData().get(jobId);
    if (!job || !holdsLease(job, leaseId)) return null;
    if (!canTransition(job.status, "done")) return null;

    const now = new Date().toISOString();
    const updated: RenderJob = {
      ...job,
      status: "done",
      stage: "publish",
      progress: 100,
      leaseId: null,
      error: null,
      outputKey: result.outputKey,
      outputUrl: result.outputUrl,
      posterUrl: result.posterUrl,
      durationInSeconds: result.durationInSeconds,
      sizeInBytes: result.sizeInBytes,
      finishedAt: now,
      updatedAt: now,
    };

    getData().set(jobId, updated);

    return updated;
  },

  async fail(jobId, leaseId, error, options) {
    const job = getData().get(jobId);
    if (!job || !holdsLease(job, leaseId)) return null;

    const status = options.willRetry ? "queued" : "failed";
    if (!canTransition(job.status, status)) return null;

    const now = new Date().toISOString();
    const updated: RenderJob = {
      ...job,
      status,
      // De lease valt vrij: de volgende poging claimt opnieuw.
      leaseId: null,
      error,
      finishedAt: options.willRetry ? null : now,
      updatedAt: now,
    };

    getData().set(jobId, updated);

    return updated;
  },
};

export function getRenderJobStore(): RenderJobStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  return memoryStore;
}
