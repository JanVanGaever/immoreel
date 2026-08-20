import { AppError, type ErrorContext } from "@/lib/errors/app-error";
import { retryPolicyFor, severityFor } from "@/lib/errors/catalogue";
import { describeError } from "@/lib/errors/normalize";
import type { AppErrorShape, ID, RenderErrorCode, RenderJobError, RenderStageId } from "@/types";

/**
 * Renderfouten met een code erbij.
 *
 * Een worker die alleen `Error: spawn ffmpeg ENOENT` in de logs achterlaat,
 * geeft twee vragen door aan wie de melding leest: wat ging er stuk, en heeft
 * het zin het nog eens te proberen. De code beantwoordt de eerste vraag, het
 * retrybeleid de tweede — en dat bepaalt of BullMQ nog een poging doet of de
 * job meteen naar `failed` schrijft.
 *
 * **Wat hier staat en wat niet.** Of opnieuw proberen zin heeft, staat niet
 * meer in dit bestand: dat komt uit de catalogus (`src/lib/errors/catalogue.ts`),
 * samen met alle andere fouten van de app. Wat hier wél staat, is de bewoording
 * binnen een render. "De opslag antwoordde niet" is de algemene zin; op een
 * exportkaart hoort "De afgewerkte video kon niet weggeschreven worden", want
 * daar weet de lezer waar het over gaat. Eén tabel met het beleid, één overlay
 * met de woorden.
 */

/** Wat de gebruiker per renderfout te zien krijgt. Geen stacktraces in de UI. */
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
 * Die afweging staat in de catalogus; hier wordt ze alleen opgevraagd.
 */
function isRetryable(code: RenderErrorCode): boolean {
  return retryPolicyFor(code).mode !== "none";
}

export class RenderError extends AppError {
  /** Alleen een versmalling van het type; de waarde komt uit `AppError`. */
  declare readonly code: RenderErrorCode;

  readonly stage: RenderStageId | null;

  constructor(
    code: RenderErrorCode,
    options: {
      stage?: RenderStageId | null;
      detail?: string;
      cause?: unknown;
      context?: ErrorContext;
    } = {},
  ) {
    super(code, {
      message: MESSAGES[code],
      domain: "render",
      detail: options.detail ?? null,
      cause: options.cause,
      context: { ...options.context, stage: options.stage ?? null },
    });

    this.name = "RenderError";
    this.stage = options.stage ?? null;
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
      detail: error.detail ?? describeError(error),
      stage: error.stage ?? fallbackStage,
      retryable: isRetryable(error.code),
      at,
    };
  }

  return {
    code: "unknown",
    message: MESSAGES.unknown,
    detail: describeError(error),
    stage: fallbackStage,
    retryable: isRetryable("unknown"),
    at,
  };
}

/**
 * Een bewaarde renderfout klaarmaken voor het scherm.
 *
 * Een `RenderJobError` komt uit de databank en een `RenderJobSnapshot.error`
 * over de lijn; allebei zijn ze smaller dan wat de foutcomponenten willen
 * weten. Deze functie vult de rest aan uit de catalogus, zodat een mislukte
 * export er hetzelfde uitziet als een mislukte upload of een mislukte betaling.
 *
 * Als verwijzing dient het jobid en niet een nieuw `errorId`: deze fout is al
 * bewaard, en wie ermee belt, wordt op dat jobid teruggevonden — in het
 * beheerscherm, in de wachtrij en in de logs van de worker.
 */
export function toRenderErrorShape(
  error: { code: RenderErrorCode; message: string; retryable: boolean },
  options: { jobId?: ID; at?: string } = {},
): AppErrorShape {
  return {
    code: error.code,
    domain: "render",
    severity: severityFor(error.code),
    message: error.message,
    hint: error.retryable
      ? "Dit lukt vaak wel bij een tweede poging."
      : "Een tweede poging geeft waarschijnlijk dezelfde fout. Pas eerst iets aan in de editor.",
    fields: null,
    retry: retryPolicyFor(error.code),
    errorId: options.jobId ? options.jobId.slice(-6).toUpperCase() : "",
    at: options.at ?? new Date().toISOString(),
  };
}

/**
 * De hele keten van oorzaken op één regel. Staat sinds de foutlaag in
 * `@/lib/errors`; hier blijft hij bereikbaar voor wie al met renderfouten werkt.
 */
export { describeError as describe };

export function messageFor(code: RenderErrorCode): string {
  return MESSAGES[code];
}

/** Alle foutcodes, in de volgorde van hierboven. Voor filters en tellingen. */
export const RENDER_ERROR_CODES = Object.keys(MESSAGES) as RenderErrorCode[];

export function isRenderErrorCode(value: unknown): value is RenderErrorCode {
  return typeof value === "string" && value in MESSAGES;
}
