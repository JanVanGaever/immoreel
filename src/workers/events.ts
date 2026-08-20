import { QueueEvents } from "bullmq";
import { RENDER_QUEUE_NAME, queuePrefix } from "@/workers/config";
import { createRedisConnection } from "@/workers/connection";
import { createLogger } from "@/workers/logger";
import type { ID, RenderProgressEvent } from "@/types";

/**
 * Meeluisteren met de wachtrij.
 *
 * De worker draait ergens anders dan de webserver, dus de voortgang moet over
 * Redis. BullMQ zet elke voortgangsmelding op een stream; wie erop luistert,
 * krijgt ze allemaal — ook die van jobs waar deze browser niets mee te maken
 * heeft. Filteren gebeurt dus bij de lezer (zie de SSE-route), niet hier.
 *
 * Eén verbinding per proces, gedeeld door alle luisteraars. Anders opent elke
 * openstaande browsertab zijn eigen blokkerende Redis-verbinding, en dat zijn
 * er op een drukke dag meer dan Redis er wil.
 */

export type RenderQueueEvent =
  | { type: "progress"; jobId: ID; progress: RenderProgressEvent | null }
  | { type: "completed"; jobId: ID }
  | { type: "failed"; jobId: ID; reason: string };

export type RenderEventListener = (event: RenderQueueEvent) => void;

const logger = createLogger("queue-events");

type Subscription = {
  events: QueueEvents;
  listeners: Set<RenderEventListener>;
  close: () => Promise<void>;
};

declare global {
  var __immoreelRenderEvents: Subscription | undefined;
}

/**
 * Begint te luisteren en geeft terug hoe je stopt. Wanneer de laatste
 * luisteraar afhaakt, gaat de verbinding dicht.
 */
export function subscribeToRenderEvents(listener: RenderEventListener): () => Promise<void> {
  const subscription = (globalThis.__immoreelRenderEvents ??= start());
  subscription.listeners.add(listener);

  let stopped = false;

  return async () => {
    if (stopped) return;
    stopped = true;

    subscription.listeners.delete(listener);
    if (subscription.listeners.size > 0) return;

    globalThis.__immoreelRenderEvents = undefined;
    await subscription.close();
  };
}

function start(): Subscription {
  // Een eigen verbinding: QueueEvents houdt ze blokkerend open en deelt ze
  // dus met niemand.
  const connection = createRedisConnection("events");
  const events = new QueueEvents(RENDER_QUEUE_NAME, {
    connection,
    prefix: queuePrefix(),
  });

  const listeners = new Set<RenderEventListener>();

  const emit = (event: RenderQueueEvent): void => {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        // Eén stukgelopen luisteraar mag de anderen niet meeslepen.
        logger.error("Luisteraar gaf een fout", error, { jobId: event.jobId });
      }
    }
  };

  events.on("progress", ({ jobId, data }) => {
    emit({ type: "progress", jobId, progress: asProgressEvent(data) });
  });

  events.on("completed", ({ jobId }) => emit({ type: "completed", jobId }));

  events.on("failed", ({ jobId, failedReason }) => {
    emit({ type: "failed", jobId, reason: failedReason });
  });

  events.on("error", (error) => logger.error("Eventstroom gaf een fout", error));

  return {
    events,
    listeners,
    close: async () => {
      await events.close();
      await connection.quit().catch(() => connection.disconnect());
    },
  };
}

/**
 * De voortgang komt als los JSON uit Redis; alles wat er niet uitziet zoals
 * wij het versturen, gaat als `null` door en de lezer valt terug op de store.
 */
function asProgressEvent(data: unknown): RenderProgressEvent | null {
  if (!data || typeof data !== "object") return null;

  const candidate = data as Partial<RenderProgressEvent>;
  const complete =
    typeof candidate.jobId === "string" &&
    typeof candidate.projectId === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.progress === "number";

  return complete ? (candidate as RenderProgressEvent) : null;
}
