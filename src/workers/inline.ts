import { isInlineWorkerEnabled, isQueueConfigured } from "@/workers/config";
import { createLogger } from "@/workers/logger";
import { createRenderWorker, type RenderWorker } from "@/workers/render-worker";

/**
 * De worker meedraaien in het proces van de webserver.
 *
 * Alleen voor ontwikkelen, en het is geen luxe: zolang de stores in het
 * geheugen zitten (`src/db/`), ziet een los workerproces de projecten van de
 * app niet en mislukt elke render met `project-missing`. Met
 * `RENDER_WORKER_INLINE=1` deelt de worker het geheugen van de app en is de
 * hele keten — knop, wachtrij, voortgang, resultaat — echt te volgen.
 *
 * Zodra de databank er staat, mag dit weg: dan hoort de worker in zijn eigen
 * proces, ook lokaal.
 */

declare global {
  var __immoreelInlineWorker: RenderWorker | undefined;
}

export function ensureInlineRenderWorker(): void {
  if (!isInlineWorkerEnabled() || !isQueueConfigured()) return;
  if (globalThis.__immoreelInlineWorker) return;

  const logger = createLogger("inline-worker");

  // Eén exemplaar per proces, ook na een hot reload.
  globalThis.__immoreelInlineWorker = createRenderWorker({ concurrency: 1 });
  logger.warn("Renderworker draait mee in de webserver (RENDER_WORKER_INLINE=1)");
}
