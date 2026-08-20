import { entryFor } from "@/lib/errors/catalogue";
import type {
  AppErrorCode,
  AppErrorShape,
  ErrorDomain,
  ErrorSeverity,
  FieldErrors,
  RetryPolicy,
} from "@/types/error";

/**
 * De fout van deze app.
 *
 * Eén klasse, en de rest van de app kent hem. Wat er in deze klasse zit dat een
 * kale `Error` niet heeft:
 *
 * - **Een code.** Zodat een scherm iets kan beslissen zonder een zin te lezen.
 * - **Twee teksten.** `message` voor de gebruiker, `detail` voor de logs. Dat
 *   onderscheid is het hele punt: een klant die "ECONNREFUSED 10.0.3.7:6379"
 *   te zien krijgt, weet nog niets — en wij die "Er ging iets mis" in onze logs
 *   terugvinden, ook niet.
 * - **Een retrybeleid**, uit de catalogus. Niet uit het scherm.
 * - **Een `errorId`.** Dezelfde vier tekens in het scherm en in de logregel.
 *   Dat is het verschil tussen "er ging iets mis bij het opslaan, gisteren" en
 *   één zoekopdracht.
 * - **Context.** Vrije velden die met de fout meereizen naar de logs:
 *   `{ projectId, jobId }`. Nooit naar de browser.
 *
 * `ApiError` (`src/lib/api/errors.ts`) en `RenderError`
 * (`src/lib/render/errors.ts`) erven hiervan. Ze voegen elk iets toe dat alleen
 * in hun laag bestaat — een statuscode, een renderstap — maar `instanceof
 * AppError` blijft waar, en dus werkt alles in deze map ook op hun fouten.
 */

/** Vrije velden bij een fout: alles wat de logregel bruikbaar maakt. */
export type ErrorContext = Record<string, string | number | boolean | null | undefined>;

export type AppErrorOptions = {
  /** Overschrijft de zin uit de catalogus. Alleen doen als het preciezer is. */
  message?: string;
  /** De technische kant: paden, statuscodes, de fout van de bibliotheek eronder. */
  detail?: string | null;
  fields?: FieldErrors;
  /** Voor een fout die in een ander domein ontstond dan de code doet vermoeden. */
  domain?: ErrorDomain;
  context?: ErrorContext;
  cause?: unknown;
};

/**
 * Vier tekens uit een alfabet zonder `0`, `O`, `1` en `l`: kort genoeg om over
 * te typen uit een screenshot, lang genoeg om binnen één dag uniek te zijn.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function createErrorId(): string {
  let id = "";

  for (let index = 0; index < 4; index += 1) {
    id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }

  return id;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly domain: ErrorDomain;
  readonly severity: ErrorSeverity;
  readonly retry: RetryPolicy;
  readonly fields: FieldErrors | null;
  readonly detail: string | null;
  readonly context: ErrorContext;
  readonly errorId: string;
  readonly at: string;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    const entry = entryFor(code);

    super(options.message ?? entry.message, { cause: options.cause });

    this.name = "AppError";
    this.code = code;
    this.domain = options.domain ?? entry.domain;
    this.severity = entry.severity;
    this.retry = entry.retry;
    this.fields = options.fields && Object.keys(options.fields).length > 0 ? options.fields : null;
    this.detail = options.detail ?? null;
    this.context = options.context ?? {};
    this.errorId = createErrorId();
    this.at = new Date().toISOString();
  }

  /** De zin die zegt wat de gebruiker nu kan doen; komt uit de catalogus. */
  get hint(): string | null {
    return entryFor(this.code).hint ?? null;
  }

  /** Heeft nog eens proberen zin — vanzelf of op een knop? */
  get retryable(): boolean {
    return this.retry.mode !== "none";
  }

  /** Mag de app het zelf nog eens proberen zonder iets te vragen? */
  get isAutoRetryable(): boolean {
    return this.retry.mode === "auto";
  }

  /**
   * De fout als data.
   *
   * `detail` gaat er standaard níet in. Dat is geen voorzichtigheid maar een
   * regel: in die tekst staat de fout van de laag eronder, en daar staat vaker
   * wel dan niet een pad, een hostnaam of een verbindingsstring in. Wie hem
   * nodig heeft — een logregel, een serverlogboek — vraagt er uitdrukkelijk om.
   */
  toShape(options: { includeDetail?: boolean } = {}): AppErrorShape {
    return {
      code: this.code,
      domain: this.domain,
      severity: this.severity,
      message: this.message,
      hint: this.hint,
      fields: this.fields,
      retry: this.retry,
      errorId: this.errorId,
      at: this.at,
      ...(options.includeDetail ? { detail: this.detail } : {}),
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Een `AppErrorShape` terug tot een `AppError`.
 *
 * Nodig op de grens waar data weer gedrag wordt: een serveractie geeft een
 * shape terug, het scherm wil er `retryable` op vragen. `errorId` en `at`
 * blijven staan — het is dezelfde fout, niet een nieuwe.
 */
export function fromShape(shape: AppErrorShape): AppError {
  const error = new AppError(shape.code, {
    message: shape.message,
    detail: shape.detail ?? null,
    fields: shape.fields ?? undefined,
    domain: shape.domain,
  });

  return Object.assign(error, { errorId: shape.errorId, at: shape.at });
}
