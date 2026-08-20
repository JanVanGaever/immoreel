/**
 * Alles wat de Mollie-koppeling uit de omgeving haalt, op één plek — zoals
 * `src/workers/config.ts` dat voor de renderwachtrij doet.
 *
 * Mollie kent geen aparte sleutel per omgeving: het voorvoegsel van de sleutel
 * zégt of je in test of in productie zit (`test_` of `live_`). Dat is handig én
 * gevaarlijk, dus het staat hier expliciet: `isTestMode()` bepaalt of het
 * scherm een testbanner toont, en dat is de enige plek waar dat onderscheid
 * gemaakt hoort te worden.
 */

export function isMollieConfigured(): boolean {
  return Boolean(process.env.MOLLIE_API_KEY);
}

export function getMollieApiKey(): string {
  const key = process.env.MOLLIE_API_KEY;

  if (!key) {
    throw new Error("MOLLIE_API_KEY ontbreekt. Zie .env.example.");
  }

  return key;
}

/** Testsleutel? Dan gaat er geen euro echt over en zegt de app dat ook. */
export function isTestMode(): boolean {
  return !process.env.MOLLIE_API_KEY?.startsWith("live_");
}

export const MOLLIE_API_BASE = "https://api.mollie.com/v2";

/**
 * De basis-URL van deze installatie.
 *
 * Mollie moet er zelf naartoe kunnen bellen, dus `localhost` werkt niet: bij
 * ontwikkelen zet je hier een tunnel (ngrok, cloudflared). Zonder publieke URL
 * komt de webhook nooit aan en blijft elke betaling in "wachtend" hangen —
 * `webhookUrl()` geeft daarom `null` in plaats van een adres waar niets
 * luistert, en de app valt dan terug op pollen.
 */
export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function isPubliclyReachable(): boolean {
  const url = appBaseUrl();

  return !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
}

/** Waar Mollie zijn statuswijzigingen naartoe stuurt. */
export function webhookUrl(): string | null {
  // Mollie weigert een webhookUrl die niet publiek is; hem toch meesturen
  // levert een 422 op het aanmaken van élke betaling op.
  if (!isPubliclyReachable()) return null;

  return `${appBaseUrl()}/api/billing/webhook`;
}

/** Waar de klant terugkomt na het betalen. */
export function returnUrl(paymentId: string): string {
  return `${appBaseUrl()}/billing/return?payment=${encodeURIComponent(paymentId)}`;
}

/**
 * De taal van het betaalscherm.
 *
 * Mollie toont zijn scherm in de taal die je meegeeft; laat je het weg, dan
 * gokt Mollie op het IP-adres. Voor een Belgisch kantoor is dat een gok te
 * veel: `nl_BE` geeft "Bancontact" en Belgische bankennamen, `nl_NL` niet.
 */
export function mollieLocale(): string {
  return process.env.MOLLIE_LOCALE ?? "nl_BE";
}

/**
 * De profiel-id, alleen nodig bij een OAuth- of organisatiesleutel. Met een
 * gewone API-sleutel weet Mollie zelf om welk profiel het gaat.
 */
export function mollieProfileId(): string | null {
  return process.env.MOLLIE_PROFILE_ID || null;
}
