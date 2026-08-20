import { AppError, isAppError, type ErrorContext } from "@/lib/errors/app-error";
import { codeForStatus, isAppErrorCode } from "@/lib/errors/catalogue";
import type { AppErrorCode, FieldErrors } from "@/types/error";

/**
 * Alles wat er misgaat, tot één soort fout maken.
 *
 * Een `catch` vangt van alles: een `AppError` die we zelf gooiden, een
 * `TypeError` van `fetch` omdat de wifi wegviel, een `DOMException` omdat de
 * gebruiker op annuleren drukte, een string uit een bibliotheek die het niet zo
 * nauw neemt. Zonder deze module doet elk `catch`-blok zijn eigen gok over wat
 * het daar heeft, en dan verschilt de melding per scherm terwijl de oorzaak
 * dezelfde is.
 *
 * Eén functie, `toAppError`, en daarna weet je wat je hebt.
 */

/** Zo herken je een geannuleerde `fetch` of een afgebroken upload. */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "AbortError";

  return error instanceof Error && error.name === "AbortError";
}

/**
 * Een `fetch` die niet eens de server bereikte, gooit een `TypeError` — en de
 * tekst erbij verschilt per browser. Vandaar geen tekstvergelijking maar de
 * vraag die er echt toe doet: staat dit toestel online?
 */
function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export type NormalizeOptions = {
  /** De code voor wat we niet herkennen. Standaard `unknown`. */
  fallback?: AppErrorCode;
  context?: ErrorContext;
};

/**
 * Wat er ook binnenkwam, er komt een `AppError` uit.
 *
 * De volgorde is de volgorde van zekerheid: eerst wat we zelf gooiden, dan wat
 * de browser standaard gooit, dan de gok.
 */
export function toAppError(error: unknown, options: NormalizeOptions = {}): AppError {
  const { fallback = "unknown", context } = options;

  // Al goed. Context erbij die deze laag kent, zonder de fout te vervangen —
  // de `errorId` moet dezelfde blijven als die al ergens gelogd is.
  if (isAppError(error)) {
    if (context) Object.assign(error.context, context);

    return error;
  }

  if (isAbortError(error)) {
    return new AppError("aborted", { detail: describeError(error), context });
  }

  if (isNetworkFailure(error)) {
    return new AppError(isOffline() ? "offline" : "network", {
      detail: describeError(error),
      cause: error,
      context,
    });
  }

  return new AppError(fallback, {
    detail: describeError(error),
    cause: error,
    context,
  });
}

/**
 * De foutenvelop van onze eigen API terug tot een fout.
 *
 * De vorm staat in `src/lib/api/errors.ts`: `{ error: { code, message, fields } }`.
 * Komt er iets anders binnen — een proxy die HTML teruggeeft, een gateway met
 * een eigen mening — dan valt deze functie terug op de statuscode. Dat is een
 * grovere gok, maar nog altijd een betere dan "er ging iets mis".
 */
export function toAppErrorFromResponse(
  response: Response,
  body: unknown,
  options: NormalizeOptions = {},
): AppError {
  const envelope = readErrorEnvelope(body);
  const code = envelope?.code ?? codeForStatus(response.status);

  return new AppError(code, {
    message: envelope?.message,
    fields: envelope?.fields,
    detail: `HTTP ${response.status} ${response.statusText} — ${response.url}`,
    context: { ...options.context, status: response.status },
  });
}

/** De foutenvelop van onze eigen API, uitgepakt. */
export type ErrorEnvelope = { code: AppErrorCode; message?: string; fields?: FieldErrors };

export function readErrorEnvelope(body: unknown): ErrorEnvelope | null {
  if (!body || typeof body !== "object") return null;

  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;

  const { code, message, fields } = error as Record<string, unknown>;
  if (!isAppErrorCode(code)) return null;

  return {
    code,
    message: typeof message === "string" && message !== "" ? message : undefined,
    fields: isFieldErrors(fields) ? fields : undefined,
  };
}

function isFieldErrors(value: unknown): value is FieldErrors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.values(value).every((entry) => typeof entry === "string");
}

/**
 * De hele keten van oorzaken op één regel, want dat is wat je in een log zoekt.
 *
 * ```
 * AppError: De opslag antwoordde niet. ← Error: connect ECONNREFUSED 127.0.0.1:9000
 * ```
 */
export function describeError(error: unknown): string {
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
