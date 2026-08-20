/**
 * De gereedschapskist van de route handlers.
 *
 * Vier stukken, elk met één taak:
 *
 * - `errors.ts`   de foutvorm die elke route teruggeeft, en de fouten zelf
 * - `response.ts` de antwoordvorm: JSON, statuscode, geen cache
 * - `handler.ts`  de rand waar een gegooide fout een antwoord wordt
 * - `session.ts`  sessie en rechten, met een 401/403 in plaats van een redirect
 * - `input.ts`    de vorm van wat er binnenkomt, veld per veld
 *
 * Alles hier draait op de server. Wie het in een component importeert, trekt de
 * sessie en de stores mee naar de browser — vandaar dat er geen enkel type uit
 * deze map in `src/types` staat.
 *
 * De fouten zelf komen uit `@/lib/errors`: `ApiError` is een `AppError` met een
 * statuscode erbij, en de zin, het domein en het retrybeleid staan in de
 * catalogus die de rest van de app ook gebruikt. Dat is met opzet — een client
 * die een 503 krijgt en een scherm dat een upload ziet mislukken, horen niet
 * elk hun eigen woorden voor hetzelfde te hebben.
 */

export {
  ApiError,
  conflict,
  forbidden,
  invalidInput,
  isApiError,
  notFound,
  tooLarge,
  unauthenticated,
  unavailable,
  unsupportedMedia,
} from "@/lib/api/errors";
export type { ApiErrorBody, ApiErrorCode, FieldErrors } from "@/lib/api/errors";

export { NO_STORE, jsonCreated, jsonError, jsonOk } from "@/lib/api/response";
export type { JsonInit } from "@/lib/api/response";

export { handle } from "@/lib/api/handler";
export { requireApiSession } from "@/lib/api/session";

export { InputReader, readFormFiles, readJsonObject } from "@/lib/api/input";
export type { ListOptions, NumberOptions, TextOptions } from "@/lib/api/input";
