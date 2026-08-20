import { Queue } from "bullmq";
import type { RenderPlan } from "@/lib/editor/render-plan";
import { buildRenderJobId, fingerprintRenderPlan } from "@/lib/render/fingerprint";
import { getRenderJobStore } from "@/db/render-job-store";
import { RENDER_QUEUE_NAME, jobAttempts, queuePrefix } from "@/workers/config";
import { getRedisConnection } from "@/workers/connection";
import { createLogger } from "@/workers/logger";
import type { ID, RenderJob } from "@/types";

/**
 * De wachtrij zoals de app ze gebruikt.
 *
 * Eén afspraak draagt dit hele bestand: de id van een job is geen toeval maar
 * een afgeleide van de opdracht (project + preset + renderplan). Twee keer
 * dezelfde opdracht insturen levert twee keer dezelfde id op, en BullMQ neemt
 * een job met een bestaande id niet aan. Dubbelklikken op "Export starten"
 * kost dus geen tweede render — niet door een vergrendeling ergens, maar
 * omdat de tweede opdracht letterlijk dezelfde is als de eerste.
 */

export const RENDER_JOB_NAME = "render.video";

/**
 * Wat er in Redis komt te staan. Bewust klein: alleen verwijzingen, geen
 * kopie van het project. Een payload die het renderplan meedraagt, is bij het
 * uitvoeren al verouderd — de worker haalt het plan zelf op.
 */
export type RenderJobData = {
  jobId: ID;
  organisationId: ID;
  projectId: ID;
  presetId: ID;
  requestedBy: ID;
  fingerprint: string;
  queuedAt: string;
};

/** Wat de worker teruggeeft; komt zo in het `completed`-event terecht. */
export type RenderJobOutcome = {
  jobId: ID;
  /** `true` wanneer de render al bestond en er niets opnieuw gemaakt is. */
  skipped: boolean;
  outputKey: string | null;
  outputUrl: string | null;
  durationInSeconds: number | null;
};

export type RenderQueue = Queue<RenderJobData, RenderJobOutcome, typeof RENDER_JOB_NAME>;

const logger = createLogger("queue");

declare global {
  var __immoreelRenderQueue: RenderQueue | undefined;
}

export function getRenderQueue(): RenderQueue {
  globalThis.__immoreelRenderQueue ??= new Queue<
    RenderJobData,
    RenderJobOutcome,
    typeof RENDER_JOB_NAME
  >(RENDER_QUEUE_NAME, {
    connection: getRedisConnection("queue"),
    prefix: queuePrefix(),
    defaultJobOptions: {
      attempts: jobAttempts(),
      // Een opslag die even niet antwoordt, is meestal na een halve minuut
      // wel bij; meteen opnieuw proberen maakt het alleen drukker.
      backoff: { type: "exponential", delay: 5_000 },
      // Afgewerkte jobs blijven staan: zolang ze in Redis zitten, weigert
      // BullMQ dezelfde id opnieuw en blijft dubbel insturen gratis.
      removeOnComplete: { age: 7 * 24 * 3600, count: 1_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });

  return globalThis.__immoreelRenderQueue;
}

export type EnqueueRenderInput = {
  organisationId: ID;
  projectId: ID;
  presetId: ID;
  requestedBy: ID;
  /** Het plan bepaalt de vingerafdruk en dus de id van de job. */
  plan: RenderPlan;
};

export type EnqueueRenderResult = {
  job: RenderJob;
  /** Waarom er wel of geen nieuwe render gestart is. */
  reason: "new" | "already-queued" | "already-done" | "retried";
};

/**
 * Een render aanvragen. Veilig om twee keer te doen — dat is het punt.
 *
 * De volgorde is niet vrijblijvend: eerst de rij in de store, dan pas de job in
 * Redis. Valt het proces tussen die twee stappen weg, dan blijft er een job
 * `queued` staan die nooit gedraaid heeft; dat is te zien en opnieuw in te
 * sturen. Andersom zou er gerenderd worden zonder dat iemand weet waar het
 * resultaat heen moet.
 */
export async function enqueueRenderJob(input: EnqueueRenderInput): Promise<EnqueueRenderResult> {
  const fingerprint = fingerprintRenderPlan(input.plan);
  const jobId = buildRenderJobId({
    projectId: input.projectId,
    presetId: input.presetId,
    fingerprint,
  });

  const { job } = await getRenderJobStore().createOrGet({
    jobId,
    organisationId: input.organisationId,
    projectId: input.projectId,
    presetId: input.presetId,
    requestedBy: input.requestedBy,
    fingerprint,
  });

  // Dezelfde opdracht is al uitgevoerd; het bestand staat er nog.
  if (job.status === "done") {
    logger.info("Render bestond al", { jobId, projectId: input.projectId });

    return { job, reason: "already-done" };
  }

  const queue = getRenderQueue();
  const existing = await queue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();

    // Een mislukte job hangt nog in Redis met dezelfde id. `add` zou hier
    // niets doen; opnieuw proberen is wat de gebruiker bedoelt.
    if (state === "failed") {
      await existing.retry();
      logger.info("Mislukte render opnieuw ingestuurd", { jobId, projectId: input.projectId });

      return { job, reason: "retried" };
    }

    logger.debug("Render stond al in de wachtrij", { jobId, state });

    return { job, reason: "already-queued" };
  }

  await queue.add(
    RENDER_JOB_NAME,
    {
      jobId,
      organisationId: input.organisationId,
      projectId: input.projectId,
      presetId: input.presetId,
      requestedBy: input.requestedBy,
      fingerprint,
      queuedAt: job.queuedAt,
    },
    { jobId },
  );

  logger.info("Render in de wachtrij gezet", {
    jobId,
    projectId: input.projectId,
    presetId: input.presetId,
  });

  return { job, reason: "new" };
}

/**
 * Wat Redis van deze job vindt: `waiting`, `active`, `completed`, `failed`,
 * `delayed` of niets meer. De store is de bron voor de UI; dit is er om te
 * zien of een job die volgens de store loopt, in de wachtrij nog bestaat.
 */
export async function getQueueState(jobId: ID): Promise<string | null> {
  const job = await getRenderQueue().getJob(jobId);
  if (!job) return null;

  return job.getState();
}

export async function closeRenderQueue(): Promise<void> {
  const queue = globalThis.__immoreelRenderQueue;
  globalThis.__immoreelRenderQueue = undefined;

  await queue?.close();
}
