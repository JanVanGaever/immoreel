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
  /** De afgewerkte exports van één project: bekijken, downloaden, opnieuw proberen. */
  projectExports: (projectId: string) => `/projects/${projectId}/exports`,
  editor: (projectId: string) => `/editor/${projectId}`,
  media: "/media",
  billing: "/billing",
  /** Betaalmethode kiezen voor dit plan; de stap vóór Mollie. */
  billingCheckout: (planId: string) => `/billing/checkout?plan=${planId}`,
  /** Waar Mollie de klant naartoe stuurt na het betalen. */
  billingReturn: (paymentId: string) => `/billing/return?payment=${encodeURIComponent(paymentId)}`,
  settings: "/settings",
  /** De huisstijl van het kantoor: eigen pagina, want ze heeft een preview nodig. */
  brandKit: "/settings/brand-kit",
  /** Het team van het kantoor: collega's, rollen en uitnodigingen. */
  team: "/settings/team",
} as const;

/**
 * Endpoints die de browser rechtstreeks aanspreekt. Serveracties staan hier
 * niet tussen; dit zijn de manieren om de voortgang van een render te volgen —
 * pollen of meeluisteren — en de bestanden die eruit komen.
 *
 * De downloads lopen bewust via de app en niet rechtstreeks naar de opslag.
 * Dat houdt drie dingen op één plek: de rechtencontrole, de bestandsnaam die
 * de makelaar in zijn downloadmap ziet, en het feit dat de opslag morgen iets
 * anders kan zijn dan vandaag.
 */
export const API_ROUTES = {
  projectRenders: (projectId: string) => `/api/projects/${projectId}/renders`,
  projectRenderStream: (projectId: string) => `/api/projects/${projectId}/renders/stream`,
  exportDownload: (projectId: string, jobId: string) =>
    `/api/projects/${projectId}/exports/${jobId}/download`,
  exportPoster: (projectId: string, jobId: string) =>
    `/api/projects/${projectId}/exports/${jobId}/poster`,
  exportArchive: (projectId: string) => `/api/projects/${projectId}/exports/zip`,
  /** De stand van één betaling; de terugkeerpagina pollt hierop. */
  paymentStatus: (paymentId: string) => `/api/billing/payments/${encodeURIComponent(paymentId)}`,
} as const;
