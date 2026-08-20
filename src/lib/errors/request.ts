import { AppError } from "@/lib/errors/app-error";
import { toAppError, toAppErrorFromResponse } from "@/lib/errors/normalize";
import { withRetry, type RetryOptions } from "@/lib/errors/retry";

/**
 * `fetch` met een fout die ergens op slaat.
 *
 * Kaal is `fetch` in dit opzicht onhandelbaar: een 500 is geen `throw` maar een
 * `response.ok === false`, een weggevallen wifi is wél een `throw` maar dan een
 * `TypeError` zonder code, en het antwoordlichaam met onze eigen foutenvelop
 * erin moet je zelf nog uitpakken. Elk scherm dat dat zelf doet, doet het net
 * iets anders — en dan verschilt de melding per scherm terwijl de oorzaak
 * dezelfde is.
 *
 * ```ts
 * const { jobs } = await requestJson<{ jobs: RenderJobSnapshot[] }>(
 *   API_ROUTES.projectRenders(projectId),
 *   { signal },
 * );
 * ```
 *
 * Wat er misgaat, komt eruit als `AppError`: met een code, een Nederlandse zin
 * en een retrybeleid. Wie dat beleid meteen wil uitvoeren, gebruikt
 * `requestJsonWithRetry`.
 */

export type RequestOptions = RequestInit & {
  /**
   * Na hoeveel milliseconden we het opgeven. Zonder deze grens blijft een
   * verzoek naar een server die de verbinding openhoudt maar nooit antwoordt,
   * eeuwig hangen — en blijft het scherm eeuwig laden.
   */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;

export async function requestJson<T>(input: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...init } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new AppError("timeout")), timeoutMs);

  // De eigen klok en het signaal van de aanroeper samen: allebei mogen ze deze
  // aanvraag stoppen, en geen van beide hoeft van de ander te weten.
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(input, {
      cache: "no-store",
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) throw toAppErrorFromResponse(response, await readBody(response));

    // 204 en een leeg lichaam zijn geldige antwoorden; die worden `undefined`.
    return (await readBody(response)) as T;
  } catch (cause) {
    // Onze eigen klok liep af: dat is een timeout, geen annulering. `reason` is
    // de fout die we hierboven meegaven, en die weet dat.
    if (controller.signal.aborted && controller.signal.reason instanceof AppError) {
      throw controller.signal.reason;
    }

    throw toAppError(cause, { context: { url: input } });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Hetzelfde, maar met het retrybeleid van de fout er meteen op toegepast. */
export function requestJsonWithRetry<T>(
  input: string,
  options: RequestOptions = {},
  retry: RetryOptions = {},
): Promise<T> {
  return withRetry(() => requestJson<T>(input, options), {
    signal: options.signal ?? undefined,
    ...retry,
  });
}

/**
 * Het lichaam als JSON, of `undefined`.
 *
 * Een foutantwoord van een proxy is HTML, en een 204 heeft niets. Allebei
 * mogen ze niet als tweede fout over de eerste heen vallen: wat er misging,
 * staat dan in de statuscode.
 */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  if (!response.headers.get("content-type")?.includes("application/json")) return undefined;

  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
