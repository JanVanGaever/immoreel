/**
 * Eenvoudige rem op inlogpogingen en herstelmails: X pogingen per venster,
 * per sleutel (meestal e-mailadres + IP).
 *
 * Bewust in het geheugen van dit proces. Dat is genoeg om scripts af te
 * remmen, maar niet om een verdeelde aanval te stoppen: zodra er meerdere
 * instanties draaien hoort dit naar Redis (of de rate limiting van de
 * hostingprovider).
 */

type Attempt = {
  count: number;
  /** Wanneer de teller weer op nul mag, in ms sinds epoch. */
  resetAt: number;
};

declare global {
  var __immoreelRateLimit: Map<string, Attempt> | undefined;
}

function getAttempts(): Map<string, Attempt> {
  globalThis.__immoreelRateLimit ??= new Map();
  return globalThis.__immoreelRateLimit;
}

export type RateLimitOptions = {
  /** Aantal pogingen binnen het venster. */
  limit: number;
  /** Lengte van het venster in seconden. */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconden tot de teller weer op nul staat. */
  retryAfterSeconds: number;
};

/** Telt een poging mee en zegt of ze nog mag. */
export function consumeAttempt(key: string, options: RateLimitOptions): RateLimitResult {
  const attempts = getAttempts();
  const now = Date.now();
  const existing = attempts.get(key);

  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + options.windowSeconds * 1000 });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  const allowed = existing.count <= options.limit;

  return {
    allowed,
    remaining: Math.max(0, options.limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/** Na een geslaagde poging is de teller niet meer nodig. */
export function clearAttempts(key: string): void {
  getAttempts().delete(key);
}

export const LOGIN_RATE_LIMIT: RateLimitOptions = { limit: 8, windowSeconds: 15 * 60 };
export const EMAIL_RATE_LIMIT: RateLimitOptions = { limit: 5, windowSeconds: 15 * 60 };
