import type { BadgeVariant } from "@/components/ui/badge";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getPlan } from "@/lib/billing/plans";
import { formatCurrency } from "@/lib/format";
import { RENDER_STAGE_LABELS } from "@/lib/render/status";
import type {
  AdminLogEntry,
  AdminLogLevel,
  AdminLogSource,
  AdminOrganisationRef,
  CheckoutAttempt,
  Invoice,
  Membership,
  Organisation,
  RenderJob,
  UserRecord,
  VideoProject,
} from "@/types";

/**
 * De logstroom van het paneel.
 *
 * Er is nog geen logdienst waar dit paneel op aansluit, en doen alsof van wel
 * zou het onbetrouwbaar maken op het enige moment dat het telt. Wat hier staat,
 * is daarom *afgeleid*: elke tijdstempel die de app bewaart, wordt één regel.
 * Een job heeft een `queuedAt`, een `startedAt`, een `finishedAt` en soms een
 * fout met een tijdstip — dat zijn vier regels die samen vertellen waar het
 * misliep, en ze zijn even waar als de rij waar ze uit komen.
 *
 * Wat het dus *niet* is: de stdout van de worker (die staat in JSON-regels,
 * zie `src/workers/logger.ts`) en alles wat gebeurde zonder een spoor achter
 * te laten. Het paneel zegt dat er ook bij, zodat niemand hier conclusies uit
 * trekt die het niet kan dragen.
 */

export const ADMIN_LOG_LEVEL_LABELS: Record<AdminLogLevel, string> = {
  info: "Info",
  warning: "Let op",
  error: "Fout",
};

export const ADMIN_LOG_LEVEL_VARIANTS: Record<AdminLogLevel, BadgeVariant> = {
  info: "neutral",
  warning: "warning",
  error: "danger",
};

export const ADMIN_LOG_SOURCE_LABELS: Record<AdminLogSource, string> = {
  account: "Account",
  kantoor: "Kantoor",
  project: "Project",
  render: "Render",
  facturatie: "Facturatie",
};

function organisationRef(organisation: Organisation | null): AdminOrganisationRef | null {
  return organisation ? { id: organisation.id, name: organisation.name } : null;
}

/** Nieuwste eerst. Bij een gelijke tijdstempel wint de id, zodat de volgorde vast ligt. */
export function sortEvents(entries: AdminLogEntry[]): AdminLogEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

/* -------------------------------------------------------------------------
 * Accounts en kantoren
 * ---------------------------------------------------------------------- */

export function userEvents(
  user: UserRecord,
  membership: Membership | null,
  organisation: Organisation | null,
): AdminLogEntry[] {
  const ref = organisationRef(organisation);
  const fields = [
    { label: "userId", value: user.id },
    { label: "e-mail", value: user.email },
  ];

  const entries: AdminLogEntry[] = [
    {
      id: `user:${user.id}:created`,
      at: user.createdAt,
      level: "info",
      source: "account",
      message: `Account aangemaakt voor ${user.name}`,
      organisation: ref,
      href: ADMIN_ROUTES.users,
      fields: membership
        ? [...fields, { label: "rol", value: ROLE_LABELS[membership.role] }]
        : fields,
    },
  ];

  if (user.emailVerifiedAt) {
    entries.push({
      id: `user:${user.id}:verified`,
      at: user.emailVerifiedAt,
      level: "info",
      source: "account",
      message: `E-mailadres bevestigd door ${user.name}`,
      organisation: ref,
      href: ADMIN_ROUTES.users,
      fields,
    });
  } else {
    // Geen gebeurtenis met een eigen tijdstip, maar wel het antwoord op de
    // meest gestelde supportvraag. Hij hangt aan het moment van aanmaken.
    entries.push({
      id: `user:${user.id}:unverified`,
      at: user.createdAt,
      level: "warning",
      source: "account",
      message: `E-mailadres van ${user.name} is nooit bevestigd`,
      organisation: ref,
      href: ADMIN_ROUTES.users,
      fields,
    });
  }

  return entries;
}

export function organisationEvents(organisation: Organisation): AdminLogEntry[] {
  return [
    {
      id: `org:${organisation.id}:created`,
      at: organisation.createdAt,
      level: "info",
      source: "kantoor",
      message: `Kantoor ${organisation.name} aangemaakt`,
      organisation: organisationRef(organisation),
      href: ADMIN_ROUTES.organisation(organisation.id),
      fields: [
        { label: "orgId", value: organisation.id },
        { label: "slug", value: organisation.slug },
      ],
    },
  ];
}

/* -------------------------------------------------------------------------
 * Projecten
 * ---------------------------------------------------------------------- */

export function projectEvents(
  project: VideoProject,
  organisation: Organisation | null,
): AdminLogEntry[] {
  const ref = organisationRef(organisation);
  const fields = [
    { label: "projectId", value: project.id },
    { label: "scènes", value: String(project.scenes.length) },
  ];

  return [
    {
      id: `project:${project.id}:created`,
      at: project.createdAt,
      level: "info",
      source: "project",
      message: `Project "${project.title}" aangemaakt`,
      organisation: ref,
      href: ADMIN_ROUTES.project(project.id),
      fields,
    },
  ];
}

/* -------------------------------------------------------------------------
 * Renders
 * ---------------------------------------------------------------------- */

/**
 * De levensloop van één renderjob als losse regels.
 *
 * `queuedAt`, `startedAt` en `finishedAt` staan los van elkaar in de rij, en
 * juist de gaten ertussen zijn wat support zoekt: een job die om 9u12 in de
 * wachtrij ging en om 9u47 pas startte, wijst naar een worker die stilstond —
 * niet naar een fout in het project.
 */
export function jobEvents(
  job: RenderJob,
  organisation: Organisation | null,
  projectTitle: string | null,
): AdminLogEntry[] {
  const ref = organisationRef(organisation);
  const href = ADMIN_ROUTES.job(job.id);
  const label = projectTitle ?? job.projectId;
  const fields = [
    { label: "jobId", value: job.id },
    { label: "preset", value: job.presetId },
  ];

  const entries: AdminLogEntry[] = [
    {
      id: `job:${job.id}:queued`,
      at: job.queuedAt,
      level: "info",
      source: "render",
      message: `Render in wachtrij voor "${label}"`,
      organisation: ref,
      href,
      fields,
    },
  ];

  if (job.startedAt) {
    entries.push({
      id: `job:${job.id}:started`,
      at: job.startedAt,
      level: "info",
      source: "render",
      message: `Render gestart voor "${label}"`,
      organisation: ref,
      href,
      fields: [...fields, { label: "poging", value: String(job.attempt) }],
    });
  }

  if (job.error) {
    entries.push({
      id: `job:${job.id}:error`,
      at: job.error.at,
      // Een fout waarna de wachtrij nog eens probeert, is nog geen verloren
      // render. Die staat als waarschuwing, zodat de foutkleur blijft betekenen
      // dat er iets definitief stukging.
      level: job.status === "failed" ? "error" : "warning",
      source: "render",
      message: `${job.error.message} (${label})`,
      organisation: ref,
      href,
      fields: [
        ...fields,
        { label: "code", value: job.error.code },
        { label: "stap", value: job.error.stage ? RENDER_STAGE_LABELS[job.error.stage] : "—" },
        { label: "opnieuw proberen", value: job.error.retryable ? "zinvol" : "zinloos" },
        ...(job.error.detail ? [{ label: "detail", value: job.error.detail }] : []),
      ],
    });
  }

  if (job.finishedAt && job.status === "done") {
    entries.push({
      id: `job:${job.id}:done`,
      at: job.finishedAt,
      level: "info",
      source: "render",
      message: `Render klaar voor "${label}"`,
      organisation: ref,
      href,
      fields,
    });
  }

  return entries;
}

/* -------------------------------------------------------------------------
 * Facturatie
 * ---------------------------------------------------------------------- */

export function invoiceEvents(
  invoice: Invoice,
  organisation: Organisation | null,
): AdminLogEntry[] {
  const ref = organisationRef(organisation);
  const fields = [
    { label: "factuur", value: invoice.number },
    { label: "bedrag", value: formatCurrency(invoice.amountInCents, invoice.currency) },
    ...(invoice.molliePaymentId
      ? [{ label: "molliePaymentId", value: invoice.molliePaymentId }]
      : []),
  ];

  const level: AdminLogLevel =
    invoice.status === "mislukt" ? "error" : invoice.status === "open" ? "warning" : "info";

  const message =
    invoice.status === "mislukt"
      ? `Betaling mislukt: ${invoice.failureReason ?? invoice.description}`
      : invoice.status === "open"
        ? `Betaling staat open: ${invoice.description}`
        : invoice.status === "terugbetaald"
          ? `Betaling terugbetaald: ${invoice.description}`
          : `Betaling ontvangen: ${invoice.description}`;

  return [
    {
      id: `invoice:${invoice.id}`,
      at: invoice.paidAt ?? invoice.createdAt,
      level,
      source: "facturatie",
      message,
      organisation: ref,
      href: ref ? ADMIN_ROUTES.organisation(ref.id) : ADMIN_ROUTES.billing,
      fields,
    },
  ];
}

export function checkoutEvents(
  checkout: CheckoutAttempt,
  organisation: Organisation | null,
): AdminLogEntry[] {
  const ref = organisationRef(organisation);
  const plan = getPlan(checkout.planId);
  const fields = [
    { label: "molliePaymentId", value: checkout.molliePaymentId },
    { label: "plan", value: plan.name },
    { label: "methode", value: checkout.method },
  ];

  const level: AdminLogLevel =
    checkout.status === "mislukt" ? "error" : checkout.status === "open" ? "warning" : "info";

  const message =
    checkout.status === "mislukt"
      ? `Afrekening mislukt: ${checkout.failureReason ?? "geen reden doorgegeven"}`
      : checkout.status === "open"
        ? `Afrekening loopt nog bij Mollie (${plan.name})`
        : `Afrekening geslaagd (${plan.name})`;

  return [
    {
      id: `checkout:${checkout.id}`,
      at: checkout.updatedAt,
      level,
      source: "facturatie",
      message,
      organisation: ref,
      href: ref ? ADMIN_ROUTES.organisation(ref.id) : ADMIN_ROUTES.billing,
      fields,
    },
  ];
}
