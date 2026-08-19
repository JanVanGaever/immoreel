import type { ID } from "@/types";

/**
 * Contract voor de achtergrondwachtrij. De implementatie (BullMQ, SQS,
 * Trigger.dev, ...) is nog niet gekozen; de app praat alleen met dit contract.
 */

export type JobPayloads = {
  "render.video": { projectId: ID; requestedBy: ID };
  "media.transcode": { assetId: ID };
  "media.thumbnail": { assetId: ID };
};

export type JobName = keyof JobPayloads;

export type Job<TName extends JobName = JobName> = {
  id: ID;
  name: TName;
  payload: JobPayloads[TName];
  attempts: number;
  createdAt: string;
};

export type JobHandler<TName extends JobName> = (job: Job<TName>) => Promise<void>;

export type JobQueue = {
  enqueue<TName extends JobName>(name: TName, payload: JobPayloads[TName]): Promise<ID>;
  process<TName extends JobName>(name: TName, handler: JobHandler<TName>): void;
};

export function getQueue(): JobQueue {
  if (!process.env.QUEUE_URL) {
    throw new Error("QUEUE_URL ontbreekt. Zie .env.example.");
  }

  // TODO: vervang door de echte queue-client.
  throw new Error("Queue is nog niet geïmplementeerd.");
}
