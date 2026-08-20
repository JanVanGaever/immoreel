import { randomUUID } from "node:crypto";
import { UnrecoverableError, Worker, type Job } from "bullmq";
import { getProjectStore } from "@/db/project-store";
import { getRenderJobStore } from "@/db/render-job-store";
import { notifyRenderFinished } from "@/lib/notifications/render";
import { toRenderJobError } from "@/lib/render/errors";
import { overallProgress } from "@/lib/render/progress";
import { describeProgress, projectStatusForJobs, toProjectStatus } from "@/lib/render/status";
import {
  RENDER_QUEUE_NAME,
  lockDurationMs,
  queuePrefix,
  workerConcurrency,
} from "@/workers/config";
import { getRedisConnection } from "@/workers/connection";
import { createLogger, type Logger } from "@/workers/logger";
import { runRenderPipeline, type RenderReport } from "@/workers/render/pipeline";
import { RENDER_JOB_NAME, type RenderJobData, type RenderJobOutcome } from "@/workers/queue";
import type { RenderJob, RenderProgressEvent, RenderStageId } from "@/types";

/**
 * De worker.
 *
 * Hij draait als eigen proces en er draaien er meerdere tegelijk, elk met
 * meerdere jobs naast elkaar. Dat maakt drie dingen belangrijk, en die drie
 * bepalen de vorm van dit bestand:
 *
 * 1. Er staat geen enkele toestand op moduleniveau. Alles wat bij een job
 *    hoort — lease, huidige stap, logger — leeft in de aanroep.
 * 2. Elke schrijfactie gaat door de lease. Een worker die zijn slot kwijt is
 *    (vastgelopen, netwerk weg) mag de job van zijn opvolger niet meer
 *    aanraken; de store weigert die updates gewoon.
 * 3. Wat al af is, wordt niet opnieuw gemaakt. Een job die als `done` in de
 *    store staat, geeft meteen zijn bestaande resultaat terug.
 */

export type RenderWorker = Worker<RenderJobData, RenderJobOutcome, typeof RENDER_JOB_NAME>;

/** Afsluiten onderbreekt lopende renders; de pijplijn luistert naar dit signaal. */
const shutdown = new AbortController();

export function createRenderWorker(options: { concurrency?: number } = {}): RenderWorker {
  const concurrency = options.concurrency ?? workerConcurrency();
  const logger = createLogger("render-worker");

  const worker: RenderWorker = new Worker<
    RenderJobData,
    RenderJobOutcome,
    typeof RENDER_JOB_NAME
  >(RENDER_QUEUE_NAME, (job, token) => processRenderJob(job, token, logger), {
    connection: getRedisConnection("worker"),
    prefix: queuePrefix(),
    concurrency,
    // Renderen duurt lang; met de standaardvergrendeling van 30 seconden zou
    // een gezonde job halverwege als vastgelopen gelden.
    lockDuration: lockDurationMs(),
    maxStalledCount: 1,
  });

  worker.on("failed", (job, error) => {
    logger.error("Job mislukt", error, {
      jobId: job?.id ?? null,
      projectId: job?.data.projectId ?? null,
      attempt: job?.attemptsStarted ?? null,
    });
  });

  worker.on("stalled", (jobId) => {
    // Bijna altijd een worker die weggevallen is of een render die langer
    // duurde dan de vergrendeling. De job gaat terug de wachtrij in.
    logger.warn("Job stond stil en gaat terug in de wachtrij", { jobId });
  });

  worker.on("error", (error) => {
    logger.error("Worker gaf een fout buiten een job om", error);
  });

  logger.info("Renderworker gestart", { concurrency, queue: RENDER_QUEUE_NAME });

  return worker;
}

/** Lopende renders afbreken. Wordt aangeroepen vóór `worker.close()`. */
export function stopRenderWork(): void {
  shutdown.abort();
}

async function processRenderJob(
  job: Job<RenderJobData, RenderJobOutcome, typeof RENDER_JOB_NAME>,
  token: string | undefined,
  baseLogger: Logger,
): Promise<RenderJobOutcome> {
  const data = job.data;
  const store = getRenderJobStore();
  const log = baseLogger.child({
    jobId: data.jobId,
    projectId: data.projectId,
    presetId: data.presetId,
    attempt: job.attemptsStarted,
  });

  // De rij hoort er al te staan — de app maakt ze vóór het insturen — maar een
  // worker die een oudere job uit Redis opvist, mag daar niet op stuklopen.
  await store.createOrGet({
    jobId: data.jobId,
    organisationId: data.organisationId,
    projectId: data.projectId,
    presetId: data.presetId,
    requestedBy: data.requestedBy,
    fingerprint: data.fingerprint,
  });

  // Het token van BullMQ hoort bij precies deze poging; ideaal als lease.
  const leaseId = token ?? `${data.jobId}-${job.attemptsStarted}-${randomUUID().slice(0, 8)}`;
  const claim = await store.claim(data.jobId, { leaseId, attempt: job.attemptsStarted });

  if (claim.outcome === "missing") {
    // Zonder rij is er niets om naartoe te schrijven; opnieuw proberen helpt niet.
    throw new UnrecoverableError(`Renderjob ${data.jobId} bestaat niet in de store.`);
  }

  if (claim.outcome === "already-done") {
    log.info("Job was al klaar; niets opnieuw gerenderd");

    return {
      jobId: data.jobId,
      skipped: true,
      outputKey: claim.job.outputKey,
      outputUrl: claim.job.outputUrl,
      durationInSeconds: claim.job.durationInSeconds,
    };
  }

  await publish(job, claim.job, log);

  let stage: RenderStageId = "prepare";

  const report: RenderReport = async (nextStage, fraction) => {
    stage = nextStage;

    const updated = await store.report(data.jobId, leaseId, {
      stage: nextStage,
      progress: overallProgress(nextStage, fraction),
    });

    if (!updated) {
      // Iemand anders heeft de job overgenomen. Doorwerken heeft geen zin meer,
      // maar hier stoppen we niet af: de pijplijn ruimt zichzelf netjes op.
      log.debug("Voortgang genegeerd; de lease is niet meer van ons", { stage: nextStage });

      return;
    }

    await publish(job, updated, log);
  };

  const startedAt = Date.now();

  try {
    const result = await runRenderPipeline({ data, signal: shutdown.signal, log, report });

    const finished = await store.finish(data.jobId, leaseId, {
      outputKey: result.outputKey,
      outputUrl: result.outputUrl,
      posterUrl: result.posterUrl,
      durationInSeconds: result.durationInSeconds,
      sizeInBytes: result.sizeInBytes,
    });

    if (finished) {
      await publish(job, finished, log);
      await notifyRenderFinished(finished);
    } else {
      log.warn("Resultaat niet bewaard: de lease was al overgenomen");
    }

    log.info("Render klaar", {
      durationMs: Date.now() - startedAt,
      outputKey: result.outputKey,
      sizeInBytes: result.sizeInBytes,
    });

    return {
      jobId: data.jobId,
      skipped: false,
      outputKey: result.outputKey,
      outputUrl: result.outputUrl,
      durationInSeconds: result.durationInSeconds,
    };
  } catch (error) {
    const failure = toRenderJobError(error, stage);
    const attempts = job.opts.attempts ?? 1;
    const willRetry = failure.retryable && job.attemptsStarted < attempts;

    const updated = await store.fail(data.jobId, leaseId, failure, { willRetry });

    if (updated) {
      await publish(job, updated, log);

      // Alleen als het hierbij blijft. Een poging die zo nog eens overgedaan
      // wordt, is geen nieuws voor de gebruiker — die ziet de balk gewoon
      // opnieuw beginnen.
      if (!willRetry) await notifyRenderFinished(updated);
    }

    log.error(
      willRetry ? "Render mislukt; er volgt een nieuwe poging" : "Render definitief mislukt",
      error,
      { stage, code: failure.code, willRetry, attempts },
    );

    // Een fout die bij elke poging hetzelfde zal zijn, hoeft de wachtrij niet
    // nog twee keer te herhalen.
    if (!failure.retryable) {
      throw new UnrecoverableError(`${failure.code}: ${failure.detail ?? failure.message}`);
    }

    throw error;
  }
}

/**
 * De stand doorgeven aan wie meekijkt: de voortgang van de job (die reist via
 * Redis naar elke browser die luistert) en de status van het project (die staat
 * in de lijst en op het dashboard).
 */
async function publish(
  job: Job<RenderJobData, RenderJobOutcome, typeof RENDER_JOB_NAME>,
  record: RenderJob,
  log: Logger,
): Promise<void> {
  const event: RenderProgressEvent = {
    jobId: record.id,
    projectId: record.projectId,
    status: record.status,
    stage: record.stage,
    progress: record.progress,
    message: describeProgress(record.status, record.stage),
    at: record.updatedAt,
  };

  await job.updateProgress(event);

  // Eén project kan naar meerdere platformen tegelijk exporteren. De status
  // van het project volgt daarom uit al zijn jobs samen, niet uit deze ene.
  const jobs = await getRenderJobStore().listForProject(record.organisationId, record.projectId);
  const status = projectStatusForJobs(jobs.length > 0 ? jobs : [record]) ?? toProjectStatus(record.status);
  const project = await getProjectStore().setProjectStatus(
    record.organisationId,
    record.projectId,
    status,
  );

  if (!project) {
    log.warn("Projectstatus niet bijgewerkt; project niet gevonden", { status });
  }
}
