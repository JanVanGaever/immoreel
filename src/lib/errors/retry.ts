import { toAppError } from "@/lib/errors/normalize";
import type { AppError } from "@/lib/errors/app-error";
import type { RetryPolicy } from "@/types/error";

/**
 * Nog eens proberen, maar dan met een reden.
 *
 * Er zijn twee manieren om dit fout te doen. De eerste is nooit opnieuw
 * proberen: dan valt een scherm om bij een hapering van een halve seconde. De
 * tweede is altijd opnieuw proberen: dan blijft een upload van een bestand dat
 * te groot is drie keer stuklopen op precies dezelfde grens, en duurt de
 * foutmelding drie keer zo lang.
 *
 * Het antwoord staat in de fout zelf (`AppError.retry`, uit de catalogus). Deze
 * module doet er alleen nog het wachten bij.
 *
 * **Waarom oplopende tussenpozen.** Als de oorzaak buiten ons ligt — een
 * wachtrij die opstart, een opslag die het even zwaar heeft — dan is meteen
 * opnieuw vragen precies wat het herstel in de weg staat. Verdubbelen geeft de
 * andere kant lucht. **Waarom er willekeur bij hoort:** twintig tabbladen die
 * op dezelfde seconde hun verbinding verloren, komen anders ook op dezelfde
 * seconde alle twintig terug.
 */

/** Hoe lang er gewacht wordt vóór poging `attempt` (1 = de tweede poging). */
export function delayFor(policy: RetryPolicy, attempt: number): number {
  if (policy.mode !== "auto" || attempt < 1) return 0;

  const exponential = policy.initialDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exponential, policy.maxDelayMs);

  // ±20% spreiding, zodat gelijktijdige pogingen uit elkaar lopen.
  return Math.round(capped * (0.8 + Math.random() * 0.4));
}

export type RetryOptions = {
  /** Breekt het wachten én de lus af. */
  signal?: AbortSignal;
  /**
   * Overschrijft het aantal pogingen uit de catalogus. Alleen voor een
   * aanroeper die meer weet dan de fout — een achtergrondtaak die best langer
   * volhoudt dan een scherm waar iemand op wacht.
   */
  maxAttempts?: number;
  /**
   * Loopt vóór elke nieuwe poging. Hiermee toont een scherm "poging 2 van 3"
   * in plaats van een wieltje dat niets zegt.
   */
  onRetry?: (error: AppError, attempt: number, delayMs: number) => void;
};

/**
 * Voert `run` uit en probeert het opnieuw zolang de fout dat toelaat.
 *
 * Alleen fouten met beleid `auto` worden herhaald. Een `manual` fout komt er
 * meteen uit: die hoort op een knop te wachten, niet op een timer. De laatste
 * fout wordt gegooid, niet de eerste — dat is degene die de gebruiker te zien
 * krijgt en waarmee hij belt.
 */
export async function withRetry<T>(
  run: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { signal, onRetry } = options;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run(attempt);
    } catch (cause) {
      const error = toAppError(cause);
      const maxAttempts = options.maxAttempts ?? error.retry.maxAttempts;

      if (!error.isAutoRetryable || attempt >= maxAttempts || signal?.aborted) throw error;

      const wait = delayFor(error.retry, attempt);

      onRetry?.(error, attempt + 1, wait);
      await sleep(wait, signal);
    }
  }
}

/**
 * Wachten dat zich laat onderbreken.
 *
 * Zonder de `abort` erin blijft een geannuleerde upload nog vijftien seconden
 * een timer bezig houden, en komt daarna alsnog terug met een poging die
 * niemand meer wil.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);

    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    }

    signal?.addEventListener("abort", finish, { once: true });
  });
}
