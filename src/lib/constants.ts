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
  /** Je eigen account: naam, e-mailadres, wachtwoord, taal en meldingen. */
  account: "/settings/account",
} as const;

/**
 * De HTTP-API. Alles wat niet via een serveractie gaat, staat hier.
 *
 * Drie soorten endpoints, en het onderscheid is de moeite waard:
 *
 * - **Beheer** (`projects`, `projectSettings`, `brandKit`, ...): JSON erin,
 *   JSON eruit. Dezelfde handelingen als de schermen doen, maar dan voor een
 *   script, een koppeling of een tweede client. Zie `src/app/api/README.md`.
 * - **Volgen** (`projectRenders`, `projectRenderStream`, `paymentStatus`):
 *   pollen of meeluisteren terwijl er iets loopt.
 * - **Bestanden** (`asset`, `exportDownload`, `exportPoster`, `exportArchive`):
 *   bytes in plaats van JSON.
 *
 * Die laatste lopen bewust via de app en niet rechtstreeks naar de opslag. Dat
 * houdt drie dingen op één plek: de rechtencontrole, de bestandsnaam die de
 * makelaar in zijn downloadmap ziet, en het feit dat de opslag morgen iets
 * anders kan zijn dan vandaag.
 */
export const API_ROUTES = {
  projects: "/api/projects",
  project: (projectId: string) => `/api/projects/${projectId}`,
  /** Alles wat over de video als geheel gaat: formaat, template, huisstijl, muziek. */
  projectSettings: (projectId: string) => `/api/projects/${projectId}/settings`,
  projectAssets: (projectId: string) => `/api/projects/${projectId}/assets`,
  /** De volledige volgorde van de foto's bewaren. */
  projectAssetOrder: (projectId: string) => `/api/projects/${projectId}/assets/order`,
  /** Het bestand van één foto; de opslag zelf is niet publiek. */
  asset: (assetId: string) => `/api/assets/${assetId}`,
  projectRenders: (projectId: string) => `/api/projects/${projectId}/renders`,
  projectRender: (projectId: string, jobId: string) =>
    `/api/projects/${projectId}/renders/${jobId}`,
  projectRenderStream: (projectId: string) => `/api/projects/${projectId}/renders/stream`,
  /** De exports van een project met hun downloadlinks. */
  projectExports: (projectId: string) => `/api/projects/${projectId}/exports`,
  brandKit: "/api/brand-kit",
  /** Abonnement, plan en verbruik in één antwoord. */
  billingStatus: "/api/billing/status",
  exportDownload: (projectId: string, jobId: string) =>
    `/api/projects/${projectId}/exports/${jobId}/download`,
  exportPoster: (projectId: string, jobId: string) =>
    `/api/projects/${projectId}/exports/${jobId}/poster`,
  exportArchive: (projectId: string) => `/api/projects/${projectId}/exports/zip`,
  /** De meldingen van de ingelogde gebruiker: de lijst achter de bel. */
  notifications: "/api/notifications",
  /** Meldingen als gelezen markeren; geeft de nieuwe stand van de teller terug. */
  notificationsRead: "/api/notifications/read",
  /** De stand van één betaling; de terugkeerpagina pollt hierop. */
  paymentStatus: (paymentId: string) => `/api/billing/payments/${encodeURIComponent(paymentId)}`,
} as const;
