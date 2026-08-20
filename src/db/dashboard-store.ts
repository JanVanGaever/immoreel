import { getAuthStore } from "@/db/auth-store";
import { getBillingStore } from "@/db/billing-store";
import { getProjectStore } from "@/db/project-store";
import { getRenderJobStore } from "@/db/render-job-store";
import { seedProjectMeta, seedStorageUsedInBytes } from "@/db/seed";
import { PLAN_LIMITS, getPlan } from "@/lib/billing";
import { emptyStatusCounts } from "@/lib/project-status";
import type {
  DashboardOverview,
  ID,
  ProjectStatusCounts,
  ProjectSummary,
  RenderJob,
  VideoProject,
} from "@/types";

/**
 * Alles wat het dashboard leest, achter één poort — net als `AuthStore`.
 *
 * Deze store bezit geen data. Ze telt wat er in de project-, render-, auth- en
 * facturatiestore staat en legt dat naast elkaar, zoals `AdminStore` dat doet
 * voor support. Dat was ooit anders: hier stond een lijst met zes verzonnen
 * panden, en die stonden in geen enkele andere store. Het dashboard toonde dus
 * projecten die de editor niet kon openen. Wat je hier ziet, bestaat nu ook.
 *
 * Een echte databank aansluiten verandert hier niets: de tellingen hieronder
 * worden dan een paar `count(*)`-query's, en `DashboardOverview` blijft gelijk.
 */
export type DashboardStore = {
  /** Alles wat het dashboard in één keer nodig heeft, per organisatie. */
  getOverview(organisationId: ID): Promise<DashboardOverview>;
};

/** Hoeveel projecten de lijst "Recente projecten" toont. */
export const RECENT_PROJECTS_LIMIT = 6;

function countByStatus(projects: VideoProject[]): ProjectStatusCounts {
  return projects.reduce<ProjectStatusCounts>((counts, project) => {
    counts[project.status] += 1;
    return counts;
  }, emptyStatusCounts());
}

/**
 * Van project naar lijstitem.
 *
 * De voortgang en de foutmelding komen uit de renderjobs en niet uit het
 * project: het project weet dát het rendert, de job weet hoe ver. Zo staat er
 * op de kaart hetzelfde percentage als op de downloadpagina.
 */
function toSummary(project: VideoProject, jobs: RenderJob[]): ProjectSummary {
  const own = jobs
    .filter((job) => job.projectId === project.id)
    .sort((a, b) => b.queuedAt.localeCompare(a.queuedAt));

  const running = own.find((job) => job.status === "processing" || job.status === "finalizing");
  const failed = own.find((job) => job.status === "failed");
  const meta = seedProjectMeta(project.id);

  return {
    id: project.id,
    title: project.title,
    status: project.status,
    aspectRatio: project.aspectRatio,
    durationInSeconds: project.durationInSeconds,
    posterUrl: project.posterUrl ?? null,
    // Referentie en gemeente horen bij het pand, en `Property` heeft nog geen
    // store (zie `src/types/property.ts`). Tot die er is, komen ze voor de
    // geseede projecten uit de seed en zijn ze voor de rest leeg — de kaart
    // laat ze dan gewoon weg.
    reference: meta?.reference ?? null,
    city: meta?.city ?? null,
    updatedAt: project.updatedAt,
    renderProgress: project.status === "renderen" ? (running?.progress ?? 0) : null,
    errorMessage: project.status === "mislukt" ? (failed?.error?.message ?? null) : null,
  };
}

/** Renders die binnen de lopende facturatieperiode afgewerkt zijn. */
function rendersInPeriod(jobs: RenderJob[], periodStart: string, periodEnd: string): RenderJob[] {
  return jobs.filter((job) => {
    if (job.status !== "done" || !job.finishedAt) return false;

    return job.finishedAt >= periodStart && job.finishedAt <= periodEnd;
  });
}

const memoryStore: DashboardStore = {
  async getOverview(organisationId) {
    const [projects, jobs, memberships, subscription] = await Promise.all([
      getProjectStore().listProjects(organisationId),
      getRenderJobStore().listAll(),
      getAuthStore().listMemberships(organisationId),
      // Anders dan het adminpaneel mag het dashboard dit wél: een kantoor
      // zonder abonnement is een kantoor dat aan zijn proefperiode begint.
      getBillingStore().getSubscription(organisationId),
    ]);

    const ownJobs = jobs.filter((job) => job.organisationId === organisationId);
    const plan = getPlan(subscription.planId);
    const limits = PLAN_LIMITS[subscription.planId];

    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;
    const rendered = rendersInPeriod(ownJobs, periodStart, periodEnd);
    const renderSeconds = rendered.reduce((total, job) => total + (job.durationInSeconds ?? 0), 0);

    return {
      totalProjects: projects.length,
      projectCounts: countByStatus(projects),
      // `listProjects` geeft de laatst bewerkte projecten eerst; de lijst neemt
      // er de bovenste van.
      recentProjects: projects
        .slice(0, RECENT_PROJECTS_LIMIT)
        .map((project) => toSummary(project, ownJobs)),
      usage: {
        periodStart,
        periodEnd,
        rendersUsed: rendered.length,
        rendersIncluded: plan.includedRendersPerMonth,
        renderMinutesUsed: Math.round(renderSeconds / 60),
        storageUsedInBytes: seedStorageUsedInBytes(organisationId),
        storageIncludedInBytes: limits.storageInBytes,
        seatsUsed: memberships.length,
        seatsIncluded: limits.seats,
      },
      subscription: {
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEndsAt: subscription.trialEndsAt ?? null,
      },
    };
  },
};

export function getDashboardStore(): DashboardStore {
  // TODO: zodra de ORM gekozen is, hier de databank-implementatie teruggeven
  // (zie `isDatabaseConfigured()` in `src/db/client.ts`).
  return memoryStore;
}
