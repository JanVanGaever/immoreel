/**
 * Wat de app van de wachtrij mag gebruiken: opdrachten insturen en meekijken.
 * De worker zelf (`render-worker.ts`, `main.ts`) staat er bewust niet bij —
 * die hoort in zijn eigen proces en niet in de Next.js-bundel.
 */
export { RENDER_QUEUE_NAME, isQueueConfigured } from "@/workers/config";
export {
  RENDER_JOB_NAME,
  closeRenderQueue,
  enqueueRenderJob,
  getQueueState,
  getRenderQueue,
} from "@/workers/queue";
export { subscribeToRenderEvents } from "@/workers/events";

export type {
  EnqueueRenderInput,
  EnqueueRenderResult,
  RenderJobData,
  RenderJobOutcome,
  RenderQueue,
} from "@/workers/queue";
export type { RenderEventListener, RenderQueueEvent } from "@/workers/events";
