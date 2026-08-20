import { createHash } from "node:crypto";
import type { RenderPlan } from "@/lib/editor/render-plan";
import type { ID } from "@/types";

/**
 * Waarom twee keer hetzelfde renderen niet twee keer rendert.
 *
 * De vingerafdruk is een hash van het volledige renderplan: scènes, beweging,
 * overgangen, geluid, huisstijl en de exportinstellingen. Verandert er niets
 * aan het plan, dan verandert de hash niet, dus krijgt de job dezelfde id, dus
 * weigert BullMQ ze een tweede keer aan te nemen. Dubbelklikken op "Export
 * starten", een herlaadpagina die de actie opnieuw verstuurt, twee makelaars
 * die tegelijk exporteren: allemaal dezelfde ene render.
 *
 * Hetzelfde geldt aan de andere kant van de pijplijn: de uitvoer krijgt een
 * sleutel die uit dezelfde id volgt, zodat een tweede poging het vorige
 * bestand overschrijft in plaats van er eentje naast te zetten.
 */

/**
 * Verhoog dit wanneer de pijplijn iets anders maakt van hetzelfde plan (andere
 * filters, andere encoder-instellingen). Oude renders blijven dan geldig, maar
 * een nieuwe opdracht krijgt een nieuwe id en wordt dus wél opnieuw gemaakt.
 */
export const RENDER_PIPELINE_VERSION = 2;

export function fingerprintRenderPlan(plan: RenderPlan): string {
  return createHash("sha256")
    .update(`v${RENDER_PIPELINE_VERSION}:`)
    .update(stableStringify(plan))
    .digest("hex");
}

/**
 * De id van de job. Kort genoeg om in een URL en in een logregel te passen,
 * lang genoeg om niet te botsen.
 */
export function buildRenderJobId(input: {
  projectId: ID;
  presetId: ID;
  fingerprint: string;
}): ID {
  const digest = createHash("sha256")
    .update(`${input.projectId}:${input.presetId}:${input.fingerprint}`)
    .digest("hex");

  return `rj_${digest.slice(0, 20)}`;
}

/** Waar het resultaat komt te staan. Afgeleid, dus altijd opnieuw te berekenen. */
export function buildOutputKey(input: {
  organisationId: ID;
  projectId: ID;
  jobId: ID;
  container: string;
}): string {
  return `renders/${input.organisationId}/${input.projectId}/${input.jobId}.${input.container}`;
}

export function buildPosterKey(input: {
  organisationId: ID;
  projectId: ID;
  jobId: ID;
}): string {
  return `renders/${input.organisationId}/${input.projectId}/${input.jobId}.jpg`;
}

/**
 * JSON met gesorteerde sleutels. `JSON.stringify` bewaart de volgorde waarin
 * velden zijn toegevoegd; twee gelijke plannen die anders zijn opgebouwd zouden
 * anders een andere hash krijgen en dus onterecht opnieuw renderen.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);

  return `{${entries.join(",")}}`;
}
