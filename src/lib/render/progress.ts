import type { RenderStageId } from "@/types";

/**
 * Voortgang die iets betekent.
 *
 * De stappen van een render duren niet even lang: de foto's ophalen is zo
 * gebeurd, de scènes renderen is het werk. Een balk die elke stap even zwaar
 * telt, staat daarom de helft van de tijd stil op 40%. Vandaar een gewicht per
 * stap; het percentage is de som van wat af is plus de fractie van de stap die
 * nu loopt.
 *
 * De gewichten zijn schattingen, geen metingen. Zodra er echt gerenderd wordt
 * zijn ze bij te stellen zonder dat er elders iets verandert.
 */

export type RenderStage = {
  id: RenderStageId;
  /** Aandeel in het geheel; de som is 100. */
  weight: number;
};

export const RENDER_STAGES: readonly RenderStage[] = [
  { id: "prepare", weight: 5 },
  { id: "fetch", weight: 15 },
  { id: "scenes", weight: 45 },
  { id: "stitch", weight: 25 },
  { id: "publish", weight: 10 },
];

const OFFSETS: Record<RenderStageId, number> = buildOffsets();

function buildOffsets(): Record<RenderStageId, number> {
  const offsets = {} as Record<RenderStageId, number>;
  let total = 0;

  for (const stage of RENDER_STAGES) {
    offsets[stage.id] = total;
    total += stage.weight;
  }

  return offsets;
}

function weightOf(stage: RenderStageId): number {
  return RENDER_STAGES.find((entry) => entry.id === stage)?.weight ?? 0;
}

/**
 * Het percentage over het geheel, gegeven hoe ver deze stap staat.
 * `fraction` loopt van 0 tot 1 binnen de stap.
 */
export function overallProgress(stage: RenderStageId, fraction: number): number {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const value = OFFSETS[stage] + weightOf(stage) * clamped;

  return Math.round(Math.min(value, 100) * 10) / 10;
}

/**
 * Voortgang mag nooit terugvallen. Bij een nieuwe poging begint de worker weer
 * bij `prepare`, maar een balk die van 80% naar 5% springt leest als "hij is
 * opnieuw begonnen en het duurt nog eens zo lang" — terwijl er niets aan de
 * hand is dat de gebruiker kan oplossen.
 */
export function keepMonotonic(previous: number, next: number): number {
  return Math.max(previous, next);
}

/** De laatste stap; handig om te weten wanneer `finalizing` begint. */
export function isFinalStage(stage: RenderStageId): boolean {
  return RENDER_STAGES.at(-1)?.id === stage;
}
