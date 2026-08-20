import { isRole } from "@/lib/auth/roles";
import { isPlanId } from "@/lib/billing/plans";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/billing/status";
import { PROJECT_STATUS_ORDER } from "@/lib/project-status";
import { isRenderErrorCode } from "@/lib/render/errors";
import { RENDER_JOB_STATUS_ORDER } from "@/lib/render/status";
import type {
  AdminBillingQuery,
  AdminJobQuery,
  AdminLogLevel,
  AdminLogQuery,
  AdminLogSource,
  AdminOrganisationQuery,
  AdminProjectQuery,
  AdminQuery,
  AdminUserQuery,
  Paginated,
  ProjectStatus,
  RenderJobStatus,
  SubscriptionStatus,
} from "@/types";

/**
 * Zoeken, filteren en bladeren voor het adminpaneel.
 *
 * Alle filters staan in de URL en nergens anders. Dat is geen principe maar
 * praktijk: support plakt een lijst in een ticket, en een collega die erop
 * klikt hoort exact hetzelfde te zien. Daarom zijn de pagina's servercomponenten
 * zonder eigen staat — de URL *is* de staat.
 */

/** Wat een pagina uit de URL krijgt. */
export type AdminSearchParams = Record<string, string | string[] | undefined>;

export const ADMIN_PAGE_SIZE = 25;

/** Namen van de queryparameters. Eén plek, zodat lezen en schrijven niet uiteenlopen. */
export const ADMIN_PARAMS = {
  search: "q",
  organisation: "org",
  page: "p",
  role: "role",
  plan: "plan",
  status: "status",
  errorCode: "code",
  level: "level",
  source: "source",
} as const;

function single(params: AdminSearchParams, key: string): string {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;

  return (first ?? "").trim();
}

function optional(params: AdminSearchParams, key: string): string | null {
  const value = single(params, key);

  return value === "" ? null : value;
}

function pageNumber(params: AdminSearchParams): number {
  const value = Number.parseInt(single(params, ADMIN_PARAMS.page), 10);

  return Number.isFinite(value) && value > 1 ? value : 1;
}

/* -------------------------------------------------------------------------
 * Van URL naar query
 * ---------------------------------------------------------------------- */

export function parseAdminQuery(params: AdminSearchParams): AdminQuery {
  return {
    search: single(params, ADMIN_PARAMS.search),
    organisationId: optional(params, ADMIN_PARAMS.organisation),
    page: pageNumber(params),
    pageSize: ADMIN_PAGE_SIZE,
  };
}

export function parseUserQuery(params: AdminSearchParams): AdminUserQuery {
  const role = optional(params, ADMIN_PARAMS.role);

  return { ...parseAdminQuery(params), role: isRole(role) ? role : null };
}

export function parseOrganisationQuery(params: AdminSearchParams): AdminOrganisationQuery {
  const plan = optional(params, ADMIN_PARAMS.plan);
  const status = optional(params, ADMIN_PARAMS.status);

  return {
    ...parseAdminQuery(params),
    planId: isPlanId(plan) ? plan : null,
    status: isSubscriptionStatus(status) ? status : null,
  };
}

export function parseProjectQuery(params: AdminSearchParams): AdminProjectQuery {
  const status = optional(params, ADMIN_PARAMS.status);

  return { ...parseAdminQuery(params), status: isProjectStatus(status) ? status : null };
}

/**
 * Renderjobs. Zonder `status` in de URL staat de filter op `failed`: negen van
 * de tien keer dat iemand deze lijst opent, is dat waarvoor hij komt. Wie alles
 * wil, kiest "Alle" — dat zet `status=all`, en dat is een bewuste keuze in
 * plaats van de stille standaard.
 */
export function parseJobQuery(params: AdminSearchParams): AdminJobQuery {
  const status = optional(params, ADMIN_PARAMS.status);
  const errorCode = optional(params, ADMIN_PARAMS.errorCode);

  return {
    ...parseAdminQuery(params),
    status: status === null ? "failed" : isRenderJobStatus(status) ? status : null,
    errorCode: isRenderErrorCode(errorCode) ? errorCode : null,
  };
}

export function parseBillingQuery(params: AdminSearchParams): AdminBillingQuery {
  const plan = optional(params, ADMIN_PARAMS.plan);
  const status = optional(params, ADMIN_PARAMS.status);

  return {
    ...parseAdminQuery(params),
    planId: isPlanId(plan) ? plan : null,
    status: isSubscriptionStatus(status) ? status : null,
  };
}

export function parseLogQuery(params: AdminSearchParams): AdminLogQuery {
  const level = optional(params, ADMIN_PARAMS.level);
  const source = optional(params, ADMIN_PARAMS.source);

  return {
    ...parseAdminQuery(params),
    level: isLogLevel(level) ? level : null,
    source: isLogSource(source) ? source : null,
  };
}

/* -------------------------------------------------------------------------
 * Type guards voor wat er uit de URL komt
 * ---------------------------------------------------------------------- */

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && (PROJECT_STATUS_ORDER as readonly string[]).includes(value);
}

export function isRenderJobStatus(value: unknown): value is RenderJobStatus {
  return (
    typeof value === "string" && (RENDER_JOB_STATUS_ORDER as readonly string[]).includes(value)
  );
}

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === "string" && value in SUBSCRIPTION_STATUS_LABELS;
}

const LOG_LEVELS: readonly AdminLogLevel[] = ["info", "warning", "error"];
const LOG_SOURCES: readonly AdminLogSource[] = [
  "account",
  "kantoor",
  "project",
  "render",
  "facturatie",
];

export function isLogLevel(value: unknown): value is AdminLogLevel {
  return typeof value === "string" && (LOG_LEVELS as readonly string[]).includes(value);
}

export function isLogSource(value: unknown): value is AdminLogSource {
  return typeof value === "string" && (LOG_SOURCES as readonly string[]).includes(value);
}

export { LOG_LEVELS, LOG_SOURCES };

/* -------------------------------------------------------------------------
 * Filteren en bladeren
 * ---------------------------------------------------------------------- */

/**
 * Vrij zoeken over een handvol velden.
 *
 * Losse woorden, en elk woord moet ergens voorkomen. Zo vindt "gent mislukt"
 * ook de rij waar die twee in verschillende kolommen staan — precies hoe
 * iemand tikt die een half gesprek aan het reconstrueren is.
 */
export function matchesSearch(search: string, fields: (string | null | undefined)[]): boolean {
  const needles = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (needles.length === 0) return true;

  const haystack = fields
    .filter((field): field is string => Boolean(field))
    .join(" ")
    .toLowerCase();

  return needles.every((needle) => haystack.includes(needle));
}

/**
 * Eén pagina uit een gefilterde lijst.
 *
 * Vraagt iemand pagina 9 van een lijst die er nog 3 heeft, dan komt de laatste
 * terug in plaats van een lege tabel: een verlopen link uit een ticket hoort
 * niet als "niets gevonden" te lezen.
 */
export function paginate<T>(items: T[], query: AdminQuery): Paginated<T> {
  const pageSize = Math.max(1, query.pageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

export function pageCount(result: Paginated<unknown>): number {
  return Math.max(1, Math.ceil(result.total / result.pageSize));
}

/* -------------------------------------------------------------------------
 * Van query naar URL
 * ---------------------------------------------------------------------- */

/**
 * Dezelfde pagina met één filter anders.
 *
 * Elke wijziging zet de paginateller terug op 1: filteren op pagina 4 en dan op
 * pagina 4 van iets anders uitkomen, is de klassieke manier om een lege tabel
 * te zien en te denken dat er niets is.
 */
export function adminHref(
  pathname: string,
  params: AdminSearchParams,
  patch: Record<string, string | null>,
): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) next.set(key, first);
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }

  if (!("p" in patch)) next.delete(ADMIN_PARAMS.page);

  const search = next.toString();

  return search ? `${pathname}?${search}` : pathname;
}
