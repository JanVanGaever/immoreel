import { AppError, type ErrorContext } from "@/lib/errors/app-error";
import { statusFor } from "@/lib/errors/catalogue";
import type { AppErrorCode, FieldErrors } from "@/types/error";

/**
 * Wat een route antwoordt als er iets misgaat.
 *
 * Eén vorm voor alle fouten, want een client die op elk endpoint een ander
 * foutantwoord krijgt, gaat op statuscodes gokken:
 *
 * ```json
 * {
 *   "error": {
 *     "code": "invalid-input",
 *     "message": "...",
 *     "fields": { "title": "..." },
 *     "errorId": "K7QM"
 *   }
 * }
 * ```
 *
 * De `code` is Engels en machinetaal — daar programmeert een client op. De
 * `message` is Nederlands en mag letterlijk op het scherm. `fields` bestaat
 * omdat elke validatie in deze app al per veld werkt (`DraftErrors`,
 * `EditorErrors`, `BrandKitErrors`): dat mapje reist ongewijzigd mee naar
 * buiten in plaats van platgeslagen te worden tot één zin. De `errorId` staat
 * ook in de logregel van dit verzoek; dat is wat een melding van een klant
 * terugvindbaar maakt.
 *
 * **Deze klasse is een `AppError`** (`src/lib/errors`). Ze voegt er één ding
 * aan toe dat alleen in deze laag bestaat: een HTTP-status. Al de rest — de
 * zin, het domein, of opnieuw proberen zin heeft — komt uit dezelfde catalogus
 * als de renderfouten en de schermen, zodat een 503 aan de API en een mislukte
 * upload in de browser niet elk hun eigen bewoording krijgen.
 */

/** De foutsoorten die een route teruggeeft; een deel van de codes van de app. */
export type ApiErrorCode = Extract<
  AppErrorCode,
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "invalid-input"
  | "unsupported-media"
  | "too-large"
  | "conflict"
  /** De dienst erachter staat er niet: geen wachtrij, geen opslag, geen sleutel. */
  | "unavailable"
  | "server-error"
>;

export type { FieldErrors };

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: FieldErrors;
    errorId: string;
  };
};

/**
 * Een fout die een route mag gooien in plaats van te retourneren.
 *
 * Gooien en niet teruggeven, omdat de helft van deze fouten diep in een
 * service ontstaat — bij het opzoeken van een project, bij het wegschrijven
 * van een bestand — en elke tussenliggende laag anders een foutantwoord zou
 * moeten doorgeven dat ze zelf niet kan maken. `handle()` in `handler.ts`
 * vangt ze op de rand op.
 */
export class ApiError extends AppError {
  /** Alleen een versmalling van het type; de waarde komt uit `AppError`. */
  declare readonly code: ApiErrorCode;

  readonly status: number;

  constructor(
    code: ApiErrorCode,
    message?: string,
    options: { fields?: FieldErrors; cause?: unknown; context?: ErrorContext; detail?: string } = {},
  ) {
    super(code, { ...options, message });

    this.name = "ApiError";
    this.status = statusFor(code);
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
        errorId: this.errorId,
      },
    };
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/* -------------------------------------------------------------------------
 * De fouten die deze app kent
 * ---------------------------------------------------------------------- */

export function unauthenticated(message = "Niet ingelogd."): ApiError {
  return new ApiError("unauthenticated", message);
}

export function forbidden(message = "Onvoldoende rechten."): ApiError {
  return new ApiError("forbidden", message);
}

export function notFound(message: string): ApiError {
  return new ApiError("not-found", message);
}

export function invalidInput(message: string, fields?: FieldErrors): ApiError {
  return new ApiError("invalid-input", message, { fields });
}

export function unsupportedMedia(message: string): ApiError {
  return new ApiError("unsupported-media", message);
}

export function tooLarge(message: string): ApiError {
  return new ApiError("too-large", message);
}

/**
 * De aanvraag klopt, maar niet met de stand van zaken: een export die nog
 * loopt, een volgorde over foto's die er niet meer zijn. Bewust geen 404 — het
 * ding bestaat, het kan alleen nu niet.
 */
export function conflict(message: string): ApiError {
  return new ApiError("conflict", message);
}

export function unavailable(message: string): ApiError {
  return new ApiError("unavailable", message);
}
