/**
 * Instellingen die zowel de middleware (edge) als de server nodig heeft.
 * Bewust zonder imports uit node:*, zodat dit bestand overal draait.
 */

export const SESSION_COOKIE = "immoreel_session";

/** Hoe lang een sessie geldig blijft: 30 dagen. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Herstelmail: kort geldig, want ze geeft toegang tot het account. */
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

/** Magic link: nog korter, want de link logt meteen in. */
export const MAGIC_LINK_TTL_SECONDS = 60 * 15;

/**
 * Bevestiging van een nieuw e-mailadres: één uur, net als een herstellink.
 * Wie het adres wijzigt, zit op dat moment achter zijn mailbox.
 */
export const EMAIL_CHANGE_TTL_SECONDS = 60 * 60;

export const AUTH_ROUTES = {
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  magicLink: "/magic-link",
  /** De uitnodiging van een collega: account aanmaken binnen een bestaand kantoor. */
  invite: "/invite",
  /** Route handler: het nieuwe e-mailadres bevestigen vanuit de mail. */
  emailChange: "/email-change",
} as const;

/** Routes die zonder sessie bereikbaar zijn. */
export const PUBLIC_ROUTES: readonly string[] = Object.values(AUTH_ROUTES);

/**
 * Routes die geen zin hebben als je al ingelogd bent. Herstellink, magic link
 * en uitnodiging staan er bewust niet bij: die moeten ook werken als er nog
 * een oude sessie openstaat.
 */
export const GUEST_ONLY_ROUTES: readonly string[] = [
  AUTH_ROUTES.login,
  AUTH_ROUTES.signup,
  AUTH_ROUTES.forgotPassword,
];

/** Waar je terechtkomt na inloggen, als er geen `redirectTo` is. */
export const AFTER_LOGIN_ROUTE = "/dashboard";

/** Naam van de query-parameter die het pad na inloggen onthoudt. */
export const REDIRECT_PARAM = "redirectTo";

const DEV_SECRET = "immoreel-dev-secret-vervang-dit-voor-productie";

/**
 * Sleutel waarmee sessietokens ondertekend worden. In productie verplicht:
 * zonder eigen sleutel zijn tokens door iedereen na te maken.
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET ontbreekt of is korter dan 32 tekens. Zie .env.example.");
  }

  return DEV_SECRET;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "http://localhost:3000";
}

/**
 * Laat alleen paden binnen de app toe als bestemming na inloggen.
 * Zonder deze controle is `?redirectTo=https://phish.example` genoeg voor
 * een open redirect.
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (PUBLIC_ROUTES.some((route) => value === route || value.startsWith(`${route}?`))) return null;

  return value;
}
