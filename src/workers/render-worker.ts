import type { Job, JobHandler } from "@/workers/queue";

/**
 * Zet een videoproject om in een afgewerkte MP4. Draait als los proces buiten
 * Next.js (zie src/workers/README.md), niet in een request.
 */
export const handleRenderVideo: JobHandler<"render.video"> = async (
  job: Job<"render.video">,
): Promise<void> => {
  // TODO: project laden, scènes ophalen, render starten, resultaat opslaan.
  void job;
};

export const handleTranscodeMedia: JobHandler<"media.transcode"> = async (
  job: Job<"media.transcode">,
): Promise<void> => {
  // TODO: bronbestand normaliseren naar een uniform formaat.
  void job;
};

export const handleGenerateThumbnail: JobHandler<"media.thumbnail"> = async (
  job: Job<"media.thumbnail">,
): Promise<void> => {
  // TODO: preview-afbeelding genereren en in storage plaatsen.
  void job;
};
