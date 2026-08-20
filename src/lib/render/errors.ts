import type { RenderErrorCode, RenderJobError, RenderStageId } from "@/types";

/**
 * Renderfouten met een code erbij.
 *
 * Een worker die alleen `Error: spawn ffmpeg ENOENT` in de logs achterlaat,
 * geeft twee vragen door aan wie de melding leest: wat ging er stuk, en heeft
 * het zin het nog eens te proberen. De code beantwoordt de eerste vraag,
 * `retryable` de tweede — en die bepaalt of BullMQ nog een poging doet of de
 * job meteen naar `failed` schrijft.
 */

/** Wat de gebruiker per fout te zien krijgt. Geen stacktraces in de UI. */
const MESSAGES: Record<RenderErrorCode, string> = {
  "project-missing": "Dit project bestaat niet meer.",
  "preset-missing": "Het gekozen exportformaat bestaat niet meer.",
  "assets-missing": "Niet alle foto's staan in de opslag.",
  "asset-download": "Een foto kon niet opgehaald worden uit de opslag.",
  ffmpeg: "De video kon niet opgebouwd worden.",
  storage: "De afgewerkte video kon niet weggeschreven worden.",
  timeout: "De render duurde te lang en is afgebroken.",
  cancelled: "De render is geannuleerd.",
  unknown: "Er ging iets mis tijdens het renderen.",
};

/**
 * Nog eens proberen helpt alleen als de oorzaak buiten de opdracht ligt: een
 * netwerk dat hapert, opslag die even niet antwoordt. Een project dat weg is
 * of een filter die FFmpeg weigert, geeft bij poging vijf exact dezelfde fout.
 */
const RETRYABLE: Record<RenderErrorCode, boolean> = {
  "project-missing": false,
  "preset-missing": false,
  "assets-missing": false,
  "asset-download": true,
  ffmpeg: false,
  storage: true,
  timeout: true,
  cancelled: false,
  unknown: true,
};

export class RenderError extends Error {
  readonly code: RenderErrorCode;
  readonly stage: RenderStageId | null;
  readonly retryable: boolean;

  constructor(
    code: RenderErrorCode,
    options: { stage?: RenderStageId | null; detail?: string; cause?: unknown } = {},
  ) {
    super(options.detail ?? MESSAGES[code], { cause: options.cause });
    this.name = "RenderError";
    this.code = code;
    this.stage = options.stage ?? null;
    this.retryable = RETRYABLE[code];
  }
}

export function isRenderError(error: unknown): error is RenderError {
  return error instanceof RenderError;
}

/**
 * Elke fout, ook eentje van drie lagen diep, wordt hier één rij die te bewaren
 * en te tonen is.
 */
export function toRenderJobError(
  error: unknown,
  fallbackStage: RenderStageId | null = null,
): RenderJobError {
  const at = new Date().toISOString();

  if (isRenderError(error)) {
    return {
      code: error.code,
      message: MESSAGES[error.code],
      detail: describe(error),
      stage: error.stage ?? fallbackStage,
      retryable: error.retryable,
      at,
    };
  }

  return {
    code: "unknown",
    message: MESSAGES.unknown,
    detail: describe(error),
    stage: fallbackStage,
    retryable: RETRYABLE.unknown,
    at,
  };
}

/** De hele keten van oorzaken op één regel, want dat is wat je in een log zoekt. */
export function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const parts = [`${error.name}: ${error.message}`];
  let cause: unknown = error.cause;

  // Meer dan een handvol schakels zegt niets meer; dan is de regel alleen lang.
  for (let depth = 0; cause instanceof Error && depth < 4; depth += 1) {
    parts.push(`${cause.name}: ${cause.message}`);
    cause = cause.cause;
  }

  return parts.join(" ← ");
}

export function messageFor(code: RenderErrorCode): string {
  return MESSAGES[code];
}
