import { getAuthStore } from "@/db/auth-store";
import { getBillingStore } from "@/db/billing-store";
import { getProjectStore } from "@/db/project-store";
import { getRenderJobStore } from "@/db/render-job-store";
import {
  checkoutEvents,
  invoiceEvents,
  jobEvents,
  organisationEvents,
  projectEvents,
  sortEvents,
  userEvents,
} from "@/lib/admin/events";
import { matchesSearch, paginate } from "@/lib/admin/query";
import { getPlan } from "@/lib/billing/plans";
import { findExportPreset } from "@/lib/editor/export-presets";
import { describeMotion } from "@/lib/editor/motion";
import { emptyStatusCounts } from "@/lib/project-status";
import { RENDER_ERROR_CODES } from "@/lib/render/errors";
import type {
  AdminBillingQuery,
  AdminBillingRow,
  AdminInvoiceRow,
  AdminJobCounts,
  AdminJobDetail,
  AdminJobQuery,
  AdminJobRow,
  AdminLogEntry,
  AdminLogQuery,
  AdminOrganisationDetail,
  AdminOrganisationQuery,
  AdminOrganisationRef,
  AdminOrganisationRow,
  AdminProjectDetail,
  AdminProjectQuery,
  AdminProjectRow,
  AdminSceneRow,
  AdminSubscriptionSummary,
  AdminSummary,
  AdminUserQuery,
  AdminUserRow,
  CheckoutAttempt,
  ID,
  Invoice,
  Membership,
  Organisation,
  Paginated,
  RenderJob,
  Subscription,
  SubscriptionStatus,
  UserRecord,
  VideoProject,
} from "@/types";

/**
 * Alles wat het interne adminpaneel leest, achter één poort.
 *
 * Deze store bezit geen data. Ze leest bij de andere stores — auth, projecten,
 * renderjobs, facturatie — en legt de stukken naast elkaar die daar bewust
 * gescheiden zijn. Dat is precies wat support nodig heeft en wat de app zelf
 * nooit doet: één gebruiker, zijn kantoor, zijn projecten, zijn mislukte
 * render en zijn laatste incasso op één scherm.
 *
 * Twee regels houden dit veilig:
 *
 * 1. **Alleen lezen.** Er staat hier geen enkele schrijfactie in, ook niet
 *    onrechtstreeks: er wordt bijvoorbeeld nooit `getSubscription()` gebruikt,
 *    want dat maakt een proefperiode aan voor een kantoor dat er nog geen had.
 *    Een supportpaneel dat de data verandert door ernaar te kijken, maakt van
 *    elk onderzoek een nieuw incident.
 * 2. **De query gaat naar binnen.** Zoeken, filteren en bladeren zijn
 *    argumenten van de methodes, niet iets dat de pagina achteraf doet. De
 *    implementatie hieronder filtert een array; de databankversie schrijft er
 *    een WHERE en een LIMIT van, zonder dat er één pagina verandert.
 *
 * Zoals overal in `src/db` draait hieronder de in-memory versie. Wat ze leest
 * leeft in het geheugen van het proces: de webserver ziet dus alleen de jobs
 * van een worker die in datzelfde proces draait (`RENDER_WORKER_INLINE`).
 */
export type AdminStore = {
  /** De cijfers op het overzicht, in één keer. */
  getSummary(): Promise<AdminSummary>;

  listUsers(query: AdminUserQuery): Promise<Paginated<AdminUserRow>>;

  listOrganisations(query: AdminOrganisationQuery): Promise<Paginated<AdminOrganisationRow>>;
  /** Eén kantoor met alles eraan: leden, projecten, renders, facturatie, tijdlijn. */
  findOrganisation(organisationId: ID): Promise<AdminOrganisationDetail | null>;

  listProjects(query: AdminProjectQuery): Promise<Paginated<AdminProjectRow>>;
  findProject(projectId: ID): Promise<AdminProjectDetail | null>;

  listJobs(query: AdminJobQuery): Promise<Paginated<AdminJobRow>>;
  findJob(jobId: ID): Promise<AdminJobDetail | null>;

  listBilling(query: AdminBillingQuery): Promise<Paginated<AdminBillingRow>>;

  /** De logstroom: afgeleid uit de tijdstempels, zie `src/lib/admin/events.ts`. */
  listLogs(query: AdminLogQuery): Promise<Paginated<AdminLogEntry>>;
};

/* -------------------------------------------------------------------------
 * Alles wat het paneel nodig heeft, in één keer opgehaald
 * ---------------------------------------------------------------------- */

type Snapshot = {
  users: UserRecord[];
  organisations: Map<ID, Organisation>;
  membershipsByUser: Map<ID, Membership>;
  membersByOrganisation: Map<ID, Membership[]>;
  projects: VideoProject[];
  projectsById: Map<ID, VideoProject>;
  jobs: RenderJob[];
  jobsByProject: Map<ID, RenderJob[]>;
  subscriptions: Map<ID, Subscription>;
  invoices: Invoice[];
  checkouts: CheckoutAttempt[];
};

/**
 * Eén rondje langs alle stores.
 *
 * Elke adminpagina heeft van bijna alles iets nodig — een joblijst zonder
 * projecttitel en kantoornaam is onleesbaar. In het geheugen kost dit niets;
 * de databankversie vervangt dit door gerichte queries met joins, en dat is
 * ook waarom het hier op één plek staat en niet verspreid over de methodes.
 */
async function snapshot(): Promise<Snapshot> {
  const [users, organisations, memberships, projects, jobs, subscriptions, invoices, checkouts] =
    await Promise.all([
      getAuthStore().listAllUsers(),
      getAuthStore().listAllOrganisations(),
      getAuthStore().listAllMemberships(),
      getProjectStore().listAllProjects(),
      getRenderJobStore().listAll(),
      getBillingStore().listAllSubscriptions(),
      getBillingStore().listAllInvoices(),
      getBillingStore().listAllCheckouts(),
    ]);

  const membershipsByUser = new Map<ID, Membership>();
  const membersByOrganisation = new Map<ID, Membership[]>();

  for (const membership of memberships) {
    membershipsByUser.set(membership.userId, membership);
    const list = membersByOrganisation.get(membership.organisationId) ?? [];
    list.push(membership);
    membersByOrganisation.set(membership.organisationId, list);
  }

  const jobsByProject = new Map<ID, RenderJob[]>();
  for (const job of jobs) {
    const list = jobsByProject.get(job.projectId) ?? [];
    list.push(job);
    jobsByProject.set(job.projectId, list);
  }

  return {
    users,
    organisations: new Map(organisations.map((organisation) => [organisation.id, organisation])),
    membershipsByUser,
    membersByOrganisation,
    projects,
    projectsById: new Map(projects.map((project) => [project.id, project])),
    jobs,
    jobsByProject,
    subscriptions: new Map(
      subscriptions.map((subscription) => [subscription.organisationId, subscription]),
    ),
    invoices,
    checkouts,
  };
}

/* -------------------------------------------------------------------------
 * Van rij naar adminvorm
 * ---------------------------------------------------------------------- */

function organisationRef(organisation: Organisation | undefined): AdminOrganisationRef | null {
  return organisation ? { id: organisation.id, name: organisation.name } : null;
}

function toSubscriptionSummary(
  subscription: Subscription | undefined,
): AdminSubscriptionSummary | null {
  if (!subscription) return null;

  return {
    planId: subscription.planId,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    trialEndsAt: subscription.trialEndsAt ?? null,
    pendingPlanId: subscription.pendingPlanId ?? null,
    paymentMethod: subscription.paymentMethod ?? null,
  };
}

function toUserRow(user: UserRecord, data: Snapshot): AdminUserRow {
  const membership = data.membershipsByUser.get(user.id) ?? null;
  const organisation = membership ? data.organisations.get(membership.organisationId) : undefined;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    hasPassword: Boolean(user.passwordHash),
    organisation: organisationRef(organisation),
    role: membership?.role ?? null,
    membershipId: membership?.id ?? null,
    createdAt: user.createdAt,
  };
}

function countJobs(jobs: RenderJob[]): AdminJobCounts {
  return jobs.reduce<AdminJobCounts>(
    (counts, job) => {
      counts.total += 1;
      if (job.status === "queued") counts.queued += 1;
      if (job.status === "processing" || job.status === "finalizing") counts.running += 1;
      if (job.status === "failed") counts.failed += 1;
      if (job.status === "done") counts.done += 1;

      return counts;
    },
    { total: 0, queued: 0, running: 0, failed: 0, done: 0 },
  );
}

function toOrganisationRow(organisation: Organisation, data: Snapshot): AdminOrganisationRow {
  const projects = data.projects.filter(
    (project) => project.organisationId === organisation.id,
  );
  const failedJobCount = data.jobs.filter(
    (job) => job.organisationId === organisation.id && job.status === "failed",
  ).length;

  return {
    id: organisation.id,
    name: organisation.name,
    slug: organisation.slug,
    vatNumber: organisation.vatNumber ?? null,
    memberCount: data.membersByOrganisation.get(organisation.id)?.length ?? 0,
    projectCount: projects.length,
    failedJobCount,
    subscription: toSubscriptionSummary(data.subscriptions.get(organisation.id)),
    createdAt: organisation.createdAt,
  };
}

function toProjectRow(project: VideoProject, data: Snapshot): AdminProjectRow {
  const organisation = data.organisations.get(project.organisationId);

  return {
    id: project.id,
    title: project.title,
    status: project.status,
    organisation: organisationRef(organisation),
    aspectRatio: project.aspectRatio,
    templateId: project.templateId ?? null,
    sceneCount: project.scenes.length,
    durationInSeconds: project.durationInSeconds,
    exportPresetCount: project.exportPresetIds.length,
    jobCounts: countJobs(data.jobsByProject.get(project.id) ?? []),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

/** "Instagram Reels — staand · 1080×1920"; de ruwe id als de preset verdwenen is. */
function presetLabel(presetId: ID): string {
  const preset = findExportPreset(presetId);
  if (!preset) return presetId;

  return `${preset.label} · ${preset.width}×${preset.height}`;
}

function toJobRow(job: RenderJob, data: Snapshot): AdminJobRow {
  const project = data.projectsById.get(job.projectId);
  const organisation = data.organisations.get(job.organisationId);
  const requester = data.users.find((user) => user.id === job.requestedBy);

  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    attempt: job.attempt,
    presetId: job.presetId,
    presetLabel: presetLabel(job.presetId),
    project: project ? { id: project.id, title: project.title } : null,
    organisation: organisationRef(organisation),
    requestedBy: requester ? { id: requester.id, name: requester.name } : null,
    error: job.error,
    sizeInBytes: job.sizeInBytes,
    durationInSeconds: job.durationInSeconds,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    updatedAt: job.updatedAt,
  };
}

function toInvoiceRow(invoice: Invoice): AdminInvoiceRow {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    description: invoice.description,
    amountInCents: invoice.amountInCents,
    currency: invoice.currency,
    method: invoice.method ?? null,
    molliePaymentId: invoice.molliePaymentId ?? null,
    failureReason: invoice.failureReason ?? null,
    paidAt: invoice.paidAt ?? null,
    createdAt: invoice.createdAt,
  };
}

function toBillingRow(organisation: Organisation, data: Snapshot): AdminBillingRow {
  const subscription = data.subscriptions.get(organisation.id);
  const invoices = data.invoices
    .filter((invoice) => invoice.organisationId === organisation.id)
    .map(toInvoiceRow);
  const openCheckout = data.checkouts.find(
    (checkout) => checkout.organisationId === organisation.id && checkout.status === "open",
  );

  return {
    organisation: { id: organisation.id, name: organisation.name },
    subscription: toSubscriptionSummary(subscription),
    monthlyPriceInCents: subscription ? getPlan(subscription.planId).pricePerMonthInCents : null,
    invoiceCount: invoices.length,
    failedInvoiceCount: invoices.filter((invoice) => invoice.status === "mislukt").length,
    lastInvoice: invoices[0] ?? null,
    invoices,
    openCheckout: openCheckout
      ? {
          molliePaymentId: openCheckout.molliePaymentId,
          planId: openCheckout.planId,
          amountInCents: openCheckout.amountInCents,
          startedAt: openCheckout.createdAt,
        }
      : null,
    mollie: {
      customerId: subscription?.mollieCustomerId ?? null,
      subscriptionId: subscription?.mollieSubscriptionId ?? null,
      mandateId: subscription?.mollieMandateId ?? null,
    },
  };
}

function toSceneRows(project: VideoProject): AdminSceneRow[] {
  return [...project.scenes]
    .sort((a, b) => a.order - b.order)
    .map((scene) => ({
      id: scene.id,
      order: scene.order,
      assetId: scene.assetId ?? null,
      durationInSeconds: scene.durationInSeconds,
      motion: describeMotion(scene.motion),
      transition: scene.transition ?? null,
      caption: scene.captionTop ?? scene.captionBottom ?? null,
    }));
}

/* -------------------------------------------------------------------------
 * Logs
 * ---------------------------------------------------------------------- */

/** Alle afgeleide gebeurtenissen, nieuwste eerst. */
function buildEvents(data: Snapshot): AdminLogEntry[] {
  const entries: AdminLogEntry[] = [];

  for (const organisation of data.organisations.values()) {
    entries.push(...organisationEvents(organisation));
  }

  for (const user of data.users) {
    const membership = data.membershipsByUser.get(user.id) ?? null;
    const organisation = membership
      ? (data.organisations.get(membership.organisationId) ?? null)
      : null;

    entries.push(...userEvents(user, membership, organisation));
  }

  for (const project of data.projects) {
    entries.push(
      ...projectEvents(project, data.organisations.get(project.organisationId) ?? null),
    );
  }

  for (const job of data.jobs) {
    entries.push(
      ...jobEvents(
        job,
        data.organisations.get(job.organisationId) ?? null,
        data.projectsById.get(job.projectId)?.title ?? null,
      ),
    );
  }

  for (const invoice of data.invoices) {
    entries.push(
      ...invoiceEvents(invoice, data.organisations.get(invoice.organisationId) ?? null),
    );
  }

  for (const checkout of data.checkouts) {
    entries.push(
      ...checkoutEvents(checkout, data.organisations.get(checkout.organisationId) ?? null),
    );
  }

  return sortEvents(entries);
}

/* -------------------------------------------------------------------------
 * De store
 * ---------------------------------------------------------------------- */

const memoryStore: AdminStore = {
  async getSummary() {
    const data = await snapshot();

    const projectsByStatus = data.projects.reduce((counts, project) => {
      counts[project.status] += 1;
      return counts;
    }, emptyStatusCounts());

    const counts = countJobs(data.jobs);
    const dayAgo = Date.now() - 86_400_000;
    const failedLastDay = data.jobs.filter(
      (job) =>
        job.status === "failed" && new Date(job.finishedAt ?? job.updatedAt).getTime() >= dayAgo,
    ).length;

    const errorCodes = RENDER_ERROR_CODES.map((code) => ({
      code,
      count: data.jobs.filter((job) => job.status === "failed" && job.error?.code === code).length,
    }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    const subscriptions: Record<SubscriptionStatus, number> = {
      proef: 0,
      wachtend: 0,
      actief: 0,
      achterstallig: 0,
      opgezegd: 0,
    };
    for (const subscription of data.subscriptions.values()) {
      subscriptions[subscription.status] += 1;
    }

    return {
      organisationCount: data.organisations.size,
      userCount: data.users.length,
      projectCount: data.projects.length,
      projectsByStatus,
      jobs: {
        total: counts.total,
        queued: counts.queued,
        running: counts.running,
        failed: counts.failed,
        done: counts.done,
        failedLastDay,
      },
      errorCodes,
      subscriptions,
      withoutSubscription: data.organisations.size - data.subscriptions.size,
      failedInvoiceCount: data.invoices.filter((invoice) => invoice.status === "mislukt").length,
      openCheckoutCount: data.checkouts.filter((checkout) => checkout.status === "open").length,
      recentFailures: data.jobs
        .filter((job) => job.status === "failed")
        .sort((a, b) => (b.finishedAt ?? b.updatedAt).localeCompare(a.finishedAt ?? a.updatedAt))
        .slice(0, 5)
        .map((job) => toJobRow(job, data)),
      recentEvents: buildEvents(data).slice(0, 8),
    };
  },

  async listUsers(query) {
    const data = await snapshot();
    const rows = data.users
      .map((user) => toUserRow(user, data))
      .filter((row) => {
        if (query.organisationId && row.organisation?.id !== query.organisationId) return false;
        if (query.role && row.role !== query.role) return false;

        // Ook op id, want een supportvraag komt vaak mét een id uit een log.
        return matchesSearch(query.search, [row.name, row.email, row.id, row.organisation?.name]);
      });

    return paginate(rows, query);
  },

  async listOrganisations(query) {
    const data = await snapshot();
    const rows = [...data.organisations.values()]
      .map((organisation) => toOrganisationRow(organisation, data))
      .filter((row) => {
        if (query.organisationId && row.id !== query.organisationId) return false;
        if (query.planId && row.subscription?.planId !== query.planId) return false;
        if (query.status && row.subscription?.status !== query.status) return false;

        return matchesSearch(query.search, [row.name, row.slug, row.id, row.vatNumber]);
      })
      // Kantoren met kapotte renders eerst: dat is waarvoor deze lijst bestaat.
      .sort(
        (a, b) => b.failedJobCount - a.failedJobCount || b.createdAt.localeCompare(a.createdAt),
      );

    return paginate(rows, query);
  },

  async findOrganisation(organisationId) {
    const data = await snapshot();
    const organisation = data.organisations.get(organisationId);
    if (!organisation) return null;

    const memberships = data.membersByOrganisation.get(organisationId) ?? [];
    const members = memberships
      .map((membership) => data.users.find((user) => user.id === membership.userId))
      .filter((user): user is UserRecord => Boolean(user))
      .map((user) => toUserRow(user, data));

    const projects = data.projects
      .filter((project) => project.organisationId === organisationId)
      .map((project) => toProjectRow(project, data));

    const jobs = data.jobs
      .filter((job) => job.organisationId === organisationId)
      .map((job) => toJobRow(job, data));

    const timeline = buildEvents(data).filter(
      (entry) => entry.organisation?.id === organisationId,
    );

    return {
      organisation: toOrganisationRow(organisation, data),
      members,
      projects,
      jobs,
      billing: toBillingRow(organisation, data),
      timeline,
    };
  },

  async listProjects(query) {
    const data = await snapshot();
    const rows = data.projects
      .map((project) => toProjectRow(project, data))
      .filter((row) => {
        if (query.organisationId && row.organisation?.id !== query.organisationId) return false;
        if (query.status && row.status !== query.status) return false;

        return matchesSearch(query.search, [row.title, row.id, row.organisation?.name]);
      });

    return paginate(rows, query);
  },

  async findProject(projectId) {
    const data = await snapshot();
    const project = data.projectsById.get(projectId);
    if (!project) return null;

    const jobs = (data.jobsByProject.get(projectId) ?? []).map((job) => toJobRow(job, data));
    const organisation = data.organisations.get(project.organisationId) ?? null;

    const timeline = sortEvents([
      ...projectEvents(project, organisation),
      ...(data.jobsByProject.get(projectId) ?? []).flatMap((job) =>
        jobEvents(job, organisation, project.title),
      ),
    ]);

    return {
      project: toProjectRow(project, data),
      jobs,
      scenes: toSceneRows(project),
      timeline,
      raw: project,
    };
  },

  async listJobs(query) {
    const data = await snapshot();
    const rows = data.jobs
      .map((job) => toJobRow(job, data))
      .filter((row) => {
        if (query.organisationId && row.organisation?.id !== query.organisationId) return false;
        if (query.status && row.status !== query.status) return false;
        if (query.errorCode && row.error?.code !== query.errorCode) return false;

        return matchesSearch(query.search, [
          row.id,
          row.project?.title,
          row.project?.id,
          row.organisation?.name,
          row.presetId,
          row.error?.code,
          row.error?.message,
        ]);
      });

    return paginate(rows, query);
  },

  async findJob(jobId) {
    const data = await snapshot();
    const job = data.jobs.find((candidate) => candidate.id === jobId);
    if (!job) return null;

    const organisation = data.organisations.get(job.organisationId) ?? null;
    const project = data.projectsById.get(job.projectId) ?? null;

    return {
      job: toJobRow(job, data),
      fingerprint: job.fingerprint,
      leaseId: job.leaseId,
      outputKey: job.outputKey,
      outputUrl: job.outputUrl,
      posterUrl: job.posterUrl,
      timeline: sortEvents(jobEvents(job, organisation, project?.title ?? null)),
      raw: job,
    };
  },

  async listBilling(query) {
    const data = await snapshot();
    const rows = [...data.organisations.values()]
      .map((organisation) => toBillingRow(organisation, data))
      .filter((row) => {
        if (query.organisationId && row.organisation.id !== query.organisationId) return false;
        if (query.planId && row.subscription?.planId !== query.planId) return false;
        if (query.status && row.subscription?.status !== query.status) return false;

        return matchesSearch(query.search, [
          row.organisation.name,
          row.organisation.id,
          row.mollie.customerId,
          row.mollie.subscriptionId,
          row.lastInvoice?.number,
          row.lastInvoice?.molliePaymentId,
        ]);
      })
      // Wat aandacht vraagt bovenaan: mislukte incasso's eerst, dan lopende
      // afrekeningen. De rest staat er om op te zoeken, niet om te bekijken.
      .sort(
        (a, b) =>
          b.failedInvoiceCount - a.failedInvoiceCount ||
          Number(Boolean(b.openCheckout)) - Number(Boolean(a.openCheckout)) ||
          a.organisation.name.localeCompare(b.organisation.name),
      );

    return paginate(rows, query);
  },

  async listLogs(query) {
    const data = await snapshot();
    const rows = buildEvents(data).filter((entry) => {
      if (query.organisationId && entry.organisation?.id !== query.organisationId) return false;
      if (query.level && entry.level !== query.level) return false;
      if (query.source && entry.source !== query.source) return false;

      return matchesSearch(query.search, [
        entry.message,
        entry.organisation?.name,
        ...entry.fields.map((field) => `${field.label} ${field.value}`),
      ]);
    });

    return paginate(rows, query);
  },
};

export function getAdminStore(): AdminStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  // De filters uit `AdminQuery` horen dan in de query zelf te staan, niet in
  // een `.filter()` erna.
  return memoryStore;
}
