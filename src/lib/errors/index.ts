/**
 * De foutlaag van Immoreel.
 *
 * Zes stukken, elk met één taak:
 *
 * - `catalogue.ts` — per foutcode: domein, zwaarte, zin, retrybeleid, status.
 *   De enige plek waar die vier dingen staan.
 * - `app-error.ts` — de fout als object: `AppError`, met een `errorId` die in
 *   het scherm én in de logregel staat.
 * - `normalize.ts` — alles wat een `catch` opvangt, tot een `AppError` maken.
 * - `logger.ts`    — één regel JSON per gebeurtenis, op server en in de browser.
 * - `retry.ts`     — het beleid uit de catalogus uitvoeren, met oplopende wacht.
 * - `request.ts`   — `fetch` waarvan de fout een `AppError` is.
 *
 * Alles hier draait zowel op de server als in de browser: dat is de reden dat
 * er geen sessie, geen store en geen `next/server` in voorkomt. De typen zelf
 * staan in `src/types/error.ts`, zodat een component ze kan importeren zonder
 * de rest mee te trekken.
 *
 * Wie de laag boven zich zoekt:
 *
 * - HTTP-routes → `@/lib/api` (`ApiError` is een `AppError` met een status)
 * - Renderjobs  → `@/lib/render/errors` (`RenderError` is een `AppError` met een stap)
 * - Schermen    → `@/components/ui` (`ErrorAlert`, `ErrorState`, `ErrorSummary`)
 */

export { AppError, fromShape, isAppError } from "@/lib/errors/app-error";
export type { AppErrorOptions, ErrorContext } from "@/lib/errors/app-error";

export {
  APP_ERROR_CODES,
  RETRY_POLICIES,
  codeForStatus,
  domainFor,
  entryFor,
  isAppErrorCode,
  messageForCode,
  retryPolicyFor,
  severityFor,
  statusFor,
} from "@/lib/errors/catalogue";
export type { ErrorEntry } from "@/lib/errors/catalogue";

export {
  describeError,
  isAbortError,
  readErrorEnvelope,
  toAppError,
  toAppErrorFromResponse,
} from "@/lib/errors/normalize";
export type { ErrorEnvelope, NormalizeOptions } from "@/lib/errors/normalize";

export { createLogger, logger } from "@/lib/errors/logger";
export type { LogFields, Logger } from "@/lib/errors/logger";

export { delayFor, sleep, withRetry } from "@/lib/errors/retry";
export type { RetryOptions } from "@/lib/errors/retry";

export { requestJson, requestJsonWithRetry } from "@/lib/errors/request";
export type { RequestOptions } from "@/lib/errors/request";
