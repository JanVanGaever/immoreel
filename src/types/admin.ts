import type { Role } from "@/types/account";
import type { ID } from "@/types/common";
import type { PaymentMethodId, PlanId, SubscriptionStatus } from "@/types/billing";
import type {
  RenderErrorCode,
  RenderJob,
  RenderJobError,
  RenderJobStatus,
  RenderStageId,
} from "@/types/render";
import type { AspectRatio, ProjectStatus } from "@/types/video";

/**
 * De vormen die het interne adminpaneel leest.
 *
 * Ze staan los van de domeintypes om één reden: het paneel kijkt over alle
 * organisaties heen, en de rest van de app doet dat nooit. Elke rij hieronder
 * draagt daarom haar organisatie mee — zonder dat veld is een regel in een
 * supportlijst onbruikbaar, want de eerste vraag bij elke melding is "van wie
 * is dit?".
 *
 * Alles hier is leesvorm. Er staat bewust geen enkel type in dat een wijziging
 * beschrijft: het paneel kijkt, het schrijft niet. Zie `src/lib/admin/access.ts`.
 */

/** Hoe een organisatie in elke adminlijst verschijnt: genoeg om te herkennen en door te klikken. */
export type AdminOrganisationRef = {
  id: ID;
  name: string;
};

export type AdminUserRef = {
  id: ID;
  name: string;
};

/* -------------------------------------------------------------------------
 * Gebruikers
 * ---------------------------------------------------------------------- */

export type AdminUserRow = {
  id: ID;
  name: string;
  email: string;
  /** `null` zolang het adres niet bevestigd is — de eerste verdachte bij "ik krijg geen mail". */
  emailVerifiedAt: string | null;
  /**
   * Of er een wachtwoord ingesteld staat. Zonder wachtwoord komt iemand alleen
   * via een magic link of een uitnodiging binnen, en dat verklaart een deel van
   * de meldingen die met "mijn wachtwoord werkt niet" beginnen.
   */
  hasPassword: boolean;
  /** `null` bij een gebruiker zonder lidmaatschap: die komt nergens meer binnen. */
  organisation: AdminOrganisationRef | null;
  role: Role | null;
  membershipId: ID | null;
  createdAt: string;
};

/* -------------------------------------------------------------------------
 * Organisaties
 * ---------------------------------------------------------------------- */

/** Het abonnement van een kantoor, zo klein als een lijstregel het nodig heeft. */
export type AdminSubscriptionSummary = {
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  pendingPlanId: PlanId | null;
  paymentMethod: PaymentMethodId | null;
};

export type AdminOrganisationRow = {
  id: ID;
  name: string;
  slug: string;
  vatNumber: string | null;
  memberCount: number;
  projectCount: number;
  /** Mislukte renders van dit kantoor; de reden dat een kantoor bovenaan een supportlijst staat. */
  failedJobCount: number;
  /**
   * `null` voor een kantoor dat de facturatiepagina nog nooit geopend heeft:
   * de proefperiode wordt pas bij het eerste bezoek weggeschreven. Het paneel
   * maakt die rij niet alsnog aan — kijken mag niets veranderen.
   */
  subscription: AdminSubscriptionSummary | null;
  createdAt: string;
};

export type AdminOrganisationDetail = {
  organisation: AdminOrganisationRow;
  members: AdminUserRow[];
  projects: AdminProjectRow[];
  /** De laatste renders van dit kantoor, nieuwste eerst. */
  jobs: AdminJobRow[];
  billing: AdminBillingRow;
  timeline: AdminLogEntry[];
};

/* -------------------------------------------------------------------------
 * Projecten
 * ---------------------------------------------------------------------- */

/** Hoeveel renders er per stand openstaan; de snelste manier om te zien waar een project vastzit. */
export type AdminJobCounts = {
  total: number;
  queued: number;
  running: number;
  failed: number;
  done: number;
};

export type AdminProjectRow = {
  id: ID;
  title: string;
  status: ProjectStatus;
  organisation: AdminOrganisationRef | null;
  aspectRatio: AspectRatio;
  templateId: ID | null;
  sceneCount: number;
  durationInSeconds: number;
  exportPresetCount: number;
  jobCounts: AdminJobCounts;
  createdAt: string;
  updatedAt: string;
};

export type AdminSceneRow = {
  id: ID;
  order: number;
  /** De foto achter deze scène. `null` betekent een lege plek in de tijdlijn. */
  assetId: ID | null;
  durationInSeconds: number;
  /** De beweging in leesbare vorm: "Inzoomen · 60% · zacht". */
  motion: string;
  transition: string | null;
  caption: string | null;
};

export type AdminProjectDetail = {
  project: AdminProjectRow;
  jobs: AdminJobRow[];
  /** Per scène: welke media, hoe lang, welke beweging. Zonder de foto zelf. */
  scenes: AdminSceneRow[];
  timeline: AdminLogEntry[];
  /** De rij zoals ze opgeslagen staat, voor in een ticket. */
  raw: unknown;
};

/* -------------------------------------------------------------------------
 * Renderjobs
 * ---------------------------------------------------------------------- */

export type AdminJobRow = {
  id: ID;
  status: RenderJobStatus;
  stage: RenderStageId | null;
  progress: number;
  attempt: number;
  presetId: ID;
  /** "Instagram Reels · 1080×1920"; de ruwe id als de preset uit de catalogus verdwenen is. */
  presetLabel: string;
  project: { id: ID; title: string } | null;
  organisation: AdminOrganisationRef | null;
  requestedBy: AdminUserRef | null;
  error: RenderJobError | null;
  sizeInBytes: number | null;
  durationInSeconds: number | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

export type AdminJobDetail = {
  job: AdminJobRow;
  /** Vingerafdruk, lease en opslagsleutel: de velden waarmee je in de workerlogs zoekt. */
  fingerprint: string;
  leaseId: string | null;
  outputKey: string | null;
  outputUrl: string | null;
  posterUrl: string | null;
  timeline: AdminLogEntry[];
  /** De rij zoals ze opgeslagen staat, voor in een ticket. */
  raw: RenderJob;
};

/* -------------------------------------------------------------------------
 * Facturatie
 * ---------------------------------------------------------------------- */

export type AdminInvoiceRow = {
  id: ID;
  number: string;
  status: "betaald" | "open" | "mislukt" | "terugbetaald";
  description: string;
  amountInCents: number;
  currency: string;
  method: PaymentMethodId | null;
  molliePaymentId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type AdminBillingRow = {
  organisation: AdminOrganisationRef;
  subscription: AdminSubscriptionSummary | null;
  /** Wat er per maand aangerekend wordt, exclusief btw. `null` zonder abonnement. */
  monthlyPriceInCents: number | null;
  invoiceCount: number;
  failedInvoiceCount: number;
  lastInvoice: AdminInvoiceRow | null;
  invoices: AdminInvoiceRow[];
  /** Loopt er een afrekening waar Mollie nog niet op geantwoord heeft? */
  openCheckout: {
    molliePaymentId: string;
    planId: PlanId;
    amountInCents: number;
    startedAt: string;
  } | null;
  /** Of het mandaat bij Mollie bestaat; zonder mandaat wordt er niets geïnd. */
  mollie: {
    customerId: string | null;
    subscriptionId: string | null;
    mandateId: string | null;
  };
};

/* -------------------------------------------------------------------------
 * Logs
 * ---------------------------------------------------------------------- */

export type AdminLogLevel = "info" | "warning" | "error";

/** Waar een gebeurtenis vandaan komt; ook de filter op de logpagina. */
export type AdminLogSource = "account" | "kantoor" | "project" | "render" | "facturatie";

/** Eén technisch veld bij een logregel: `jobId`, `code`, `stage`, ... */
export type AdminLogField = {
  label: string;
  value: string;
};

/**
 * Eén regel in de logstroom.
 *
 * Deze regels worden *afgeleid* uit de tijdstempels die de app zelf bewaart —
 * er is nog geen logdienst waar het paneel op aansluit. Dat is genoeg om te
 * zien wanneer een render vastliep of een incasso mislukte, en het is eerlijk
 * over wat het niet is: er staat niets in wat we niet ook elders opslaan.
 */
export type AdminLogEntry = {
  id: string;
  at: string;
  level: AdminLogLevel;
  source: AdminLogSource;
  message: string;
  organisation: AdminOrganisationRef | null;
  /** Waar support naartoe klikt voor de rest van het verhaal. */
  href: string | null;
  fields: AdminLogField[];
};

/* -------------------------------------------------------------------------
 * Overzicht
 * ---------------------------------------------------------------------- */

export type AdminSummary = {
  organisationCount: number;
  userCount: number;
  projectCount: number;
  projectsByStatus: Record<ProjectStatus, number>;
  jobs: {
    total: number;
    queued: number;
    running: number;
    failed: number;
    done: number;
    /** Mislukt in de laatste 24 uur: de teller die zegt of er nú iets stuk is. */
    failedLastDay: number;
  };
  /** Welke foutcodes het vaakst terugkomen, grootste eerst. */
  errorCodes: { code: RenderErrorCode; count: number }[];
  subscriptions: Record<SubscriptionStatus, number>;
  /** Kantoren zonder abonnementsrij; die hebben de facturatiepagina nooit geopend. */
  withoutSubscription: number;
  failedInvoiceCount: number;
  openCheckoutCount: number;
  /** De laatste mislukte renders, klaar om aan te klikken. */
  recentFailures: AdminJobRow[];
  /** De laatste gebeurtenissen over alles heen. */
  recentEvents: AdminLogEntry[];
};

/* -------------------------------------------------------------------------
 * Zoeken en filteren
 * ---------------------------------------------------------------------- */

/**
 * Wat elke adminlijst kan: zoeken, op één kantoor filteren, bladeren.
 *
 * De query gaat *in* de store en niet erbuiten. Dat is geen omweg: de
 * in-memory implementatie filtert een array, maar de databankversie schrijft
 * hiervan een WHERE en een LIMIT. Zou het paneel eerst alles ophalen en daarna
 * filteren, dan werkt het vandaag en valt het om bij de eerste duizend rijen.
 */
export type AdminQuery = {
  /** Vrije tekst; wat er doorzocht wordt staat per lijst in `admin-store.ts`. */
  search: string;
  organisationId: ID | null;
  page: number;
  pageSize: number;
};

export type AdminUserQuery = AdminQuery & { role: Role | null };

export type AdminOrganisationQuery = AdminQuery & {
  planId: PlanId | null;
  status: SubscriptionStatus | null;
};

export type AdminProjectQuery = AdminQuery & { status: ProjectStatus | null };

export type AdminJobQuery = AdminQuery & {
  status: RenderJobStatus | null;
  errorCode: RenderErrorCode | null;
};

export type AdminBillingQuery = AdminQuery & {
  planId: PlanId | null;
  status: SubscriptionStatus | null;
};

export type AdminLogQuery = AdminQuery & {
  level: AdminLogLevel | null;
  source: AdminLogSource | null;
};
