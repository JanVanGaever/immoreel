import { isQueueConfigured } from "@/workers/config";
import { closeRedisConnections } from "@/workers/connection";
import { createLogger } from "@/workers/logger";
import { createRenderWorker, stopRenderWork } from "@/workers/render-worker";

/**
 * Het entrypoint van het workerproces:
 *
 *   npm run worker
 *
 * Draait bewust buiten Next.js. Een render van twee minuten in een
 * requesthandler is geen trage pagina maar een pagina die niet komt.
 */

const logger = createLogger("worker-main");

if (!isQueueConfigured()) {
  logger.error("REDIS_URL ontbreekt; de worker heeft niets om uit te lezen. Zie .env.example.");
  process.exit(1);
}

const worker = createRenderWorker();

let closing = false;

/**
 * Netjes afsluiten: eerst lopende renders onderbreken, dan de worker sluiten
 * zodat hij geen nieuw werk meer aanneemt en zijn slot teruggeeft. Een job die
 * hierdoor halverwege stopt, komt gewoon terug in de wachtrij — de pijplijn is
 * er precies daarom opnieuw uitvoerbaar.
 */
async function shutdown(signal: string): Promise<void> {
  if (closing) return;
  closing = true;

  logger.info("Worker sluit af", { signal });

  // Blijft hij hangen op een render die niet reageert, dan is hard afsluiten
  // beter dan een proces dat een procesmanager moet komen doodslaan.
  const timer = setTimeout(() => {
    logger.warn("Afsluiten duurde te lang; het proces stopt geforceerd");
    process.exit(1);
  }, 20_000);
  timer.unref();

  stopRenderWork();

  try {
    await worker.close();
    await closeRedisConnections();
  } catch (error) {
    logger.error("Fout tijdens het afsluiten", error);
  }

  logger.info("Worker gestopt");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error("Belofte zonder catch", reason);
});

process.on("uncaughtException", (error) => {
  // Na een uncaught exception is de staat van het proces niet meer te
  // vertrouwen; loggen en stoppen, de procesmanager start opnieuw.
  logger.error("Onafgevangen fout; het proces stopt", error);
  void shutdown("uncaughtException");
});
