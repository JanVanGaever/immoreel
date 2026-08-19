import { PLAN_LIMITS, TRIAL_DAYS, getPlan } from "@/lib/billing";
import { emptyStatusCounts } from "@/lib/project-status";
import type { DashboardOverview, ID, ProjectSummary, ProjectStatusCounts } from "@/types";

/**
 * Alles wat het dashboard leest, achter één poort — net als `AuthStore`.
 * Zolang er geen ORM gekozen is, draait hieronder een mock; de pagina en de
 * componenten merken daar niets van.
 *
 * Een echte databank aansluiten betekent: één nieuwe implementatie van
 * `DashboardStore` schrijven en die teruggeven uit `getDashboardStore()`.
 * De vorm van `DashboardOverview` blijft dan gelijk.
 */
export type DashboardStore = {
  /** Alles wat het dashboard in één keer nodig heeft, per organisatie. */
  getOverview(organisationId: ID): Promise<DashboardOverview>;
};

/** Hoeveel projecten de lijst "Recente projecten" toont. */
export const RECENT_PROJECTS_LIMIT = 6;

/** De organisatie die bij het demoaccount hoort (zie `auth-store.ts`). */
const DEMO_ORGANISATION_ID = "org_demo";

const hours = (n: number) => n * 3_600_000;
const days = (n: number) => n * 86_400_000;

function isoFrom(now: number, offsetInMs: number): string {
  return new Date(now + offsetInMs).toISOString();
}

/** Eerste en laatste moment van de lopende kalendermaand. */
function currentPeriod(now: Date): { periodStart: string; periodEnd: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

function countByStatus(projects: ProjectSummary[]): ProjectStatusCounts {
  return projects.reduce<ProjectStatusCounts>((counts, project) => {
    counts[project.status] += 1;
    return counts;
  }, emptyStatusCounts());
}

/**
 * Een organisatie zonder projecten: alle tellers op nul en een lopende
 * proefperiode. Dit is wat een nieuwe gebruiker na de registratie ziet.
 */
function emptyOverview(now: Date): DashboardOverview {
  const plan = getPlan("starter");
  const limits = PLAN_LIMITS.starter;
  const trialEndsAt = isoFrom(now.getTime(), days(TRIAL_DAYS));

  return {
    totalProjects: 0,
    projectCounts: emptyStatusCounts(),
    recentProjects: [],
    usage: {
      ...currentPeriod(now),
      rendersUsed: 0,
      rendersIncluded: plan.includedRendersPerMonth,
      renderMinutesUsed: 0,
      storageUsedInBytes: 0,
      storageIncludedInBytes: limits.storageInBytes,
      seatsUsed: 1,
      seatsIncluded: limits.seats,
    },
    subscription: {
      planId: plan.id,
      status: "proef",
      currentPeriodEnd: trialEndsAt,
      cancelAtPeriodEnd: false,
      trialEndsAt,
    },
  };
}

/**
 * Mockdata voor het demokantoor, zodat het dashboard met echte vormen te zien
 * is. Data staat relatief aan "nu", anders veroudert het scherm zichtbaar.
 */
function demoProjects(now: number): ProjectSummary[] {
  return [
    {
      id: "prj_kortrijk_leiestraat",
      title: "Leiestraat 44 — herenhuis",
      status: "renderen",
      aspectRatio: "16:9",
      durationInSeconds: 96,
      reference: "VK-2043",
      city: "Kortrijk",
      updatedAt: isoFrom(now, -hours(0.3)),
      renderProgress: 62,
    },
    {
      id: "prj_gent_zuidpark",
      title: "Zuidparklaan 8 — nieuwbouwappartement",
      status: "klaar",
      aspectRatio: "9:16",
      durationInSeconds: 42,
      reference: "VK-2039",
      city: "Gent",
      updatedAt: isoFrom(now, -hours(5)),
    },
    {
      id: "prj_brugge_ezelstraat",
      title: "Ezelstraat 12 — handelspand",
      status: "mislukt",
      aspectRatio: "16:9",
      durationInSeconds: 78,
      reference: "VH-1188",
      city: "Brugge",
      updatedAt: isoFrom(now, -hours(9)),
      errorMessage: "Een foto kon niet gelezen worden (IMG_2291.heic).",
    },
    {
      id: "prj_hasselt_kempische",
      title: "Kempische Steenweg 210 — kantoorruimte",
      status: "wachtrij",
      aspectRatio: "16:9",
      durationInSeconds: 64,
      reference: "VH-1192",
      city: "Hasselt",
      updatedAt: isoFrom(now, -days(1)),
    },
    {
      id: "prj_antwerpen_zurenborg",
      title: "Dageraadplaats 3 — bel-etage",
      status: "in-bewerking",
      aspectRatio: "1:1",
      durationInSeconds: 55,
      reference: "VK-2051",
      city: "Antwerpen",
      updatedAt: isoFrom(now, -days(2)),
    },
    {
      id: "prj_leuven_vaartkom",
      title: "Vaartkom 61 — loft",
      status: "concept",
      aspectRatio: "9:16",
      durationInSeconds: 0,
      reference: "VK-2052",
      city: "Leuven",
      updatedAt: isoFrom(now, -days(3)),
    },
  ];
}

function demoOverview(now: Date): DashboardOverview {
  const projects = demoProjects(now.getTime());
  const plan = getPlan("kantoor");
  const limits = PLAN_LIMITS.kantoor;

  return {
    // Hoger dan de lijst: die toont alleen de laatst bewerkte projecten.
    totalProjects: 34,
    projectCounts: { ...countByStatus(projects), klaar: 26 },
    recentProjects: projects.slice(0, RECENT_PROJECTS_LIMIT),
    usage: {
      ...currentPeriod(now),
      rendersUsed: 34,
      rendersIncluded: plan.includedRendersPerMonth,
      renderMinutesUsed: 51,
      storageUsedInBytes: Math.round(18.4 * 1024 ** 3),
      storageIncludedInBytes: limits.storageInBytes,
      seatsUsed: 4,
      seatsIncluded: limits.seats,
    },
    subscription: {
      planId: plan.id,
      status: "actief",
      currentPeriodEnd: currentPeriod(now).periodEnd,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
    },
  };
}

const mockStore: DashboardStore = {
  async getOverview(organisationId) {
    const now = new Date();

    // Alleen het demokantoor heeft data. Een vers aangemaakte organisatie
    // krijgt de lege staat, precies zoals een echte nieuwe klant.
    if (organisationId === DEMO_ORGANISATION_ID && process.env.NODE_ENV !== "production") {
      return demoOverview(now);
    }

    return emptyOverview(now);
  },
};

export function getDashboardStore(): DashboardStore {
  // TODO: zodra de ORM gekozen is, hier de databank-implementatie teruggeven
  // (zie `isDatabaseConfigured()` in `src/db/client.ts`).
  return mockStore;
}
