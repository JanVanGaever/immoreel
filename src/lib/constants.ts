export const APP_NAME = "Immoreel";
export const APP_TAGLINE = "Vastgoedvideo's, automatisch gemonteerd";
export const APP_DESCRIPTION =
  "Immoreel maakt van foto's en plannen van een pand in enkele minuten een afgewerkte vastgoedvideo.";

/** Belgische markt: nl-BE als standaard, EUR als munt. */
export const DEFAULT_LOCALE = "nl-BE";
export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_TIMEZONE = "Europe/Brussels";

export const SUPPORT_EMAIL = "support@immoreel.be";

/** Routes binnen de app. De uitgelogde schermen staan in `AUTH_ROUTES`
 *  (`src/lib/auth/config.ts`), omdat de middleware die ook nodig heeft. */
export const ROUTES = {
  dashboard: "/dashboard",
  projects: "/projects",
  newProject: "/projects/new",
  project: (projectId: string) => `/projects/${projectId}`,
  editor: (projectId: string) => `/editor/${projectId}`,
  media: "/media",
  billing: "/billing",
  settings: "/settings",
  /** Ankers binnen de instellingenpagina, voor de snelkoppelingen op het dashboard. */
  brandKit: "/settings#huisstijl",
  team: "/settings#team",
} as const;
