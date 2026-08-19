import type { ID } from "@/types/common";
import type { PlanId, SubscriptionStatus } from "@/types/billing";
import type { AspectRatio, ProjectStatus } from "@/types/video";

/**
 * Vormen die het dashboard leest. Bewust smaller dan `VideoProject`: een
 * lijstitem heeft geen scènes nodig, en zo kan de datalaag later een lichte
 * query doen in plaats van hele projecten op te halen.
 */

export type ProjectSummary = {
  id: ID;
  title: string;
  status: ProjectStatus;
  aspectRatio: AspectRatio;
  durationInSeconds: number;
  posterUrl?: string | null;
  /** Referentie van het pand, zoals het kantoor die kent (bv. "VK-2043"). */
  reference?: string | null;
  city?: string | null;
  updatedAt: string;
  /** 0-100. Alleen gevuld zolang de status "renderen" is. */
  renderProgress?: number | null;
  /** Alleen gevuld bij status "mislukt". */
  errorMessage?: string | null;
};

export type ProjectStatusCounts = Record<ProjectStatus, number>;

/** Verbruik binnen één facturatieperiode; het dashboard toont de lopende maand. */
export type UsageSummary = {
  periodStart: string;
  periodEnd: string;
  rendersUsed: number;
  rendersIncluded: number;
  /** Totale duur van de geslaagde renders in deze periode. */
  renderMinutesUsed: number;
  storageUsedInBytes: number;
  storageIncludedInBytes: number;
  seatsUsed: number;
  seatsIncluded: number;
};

/** Wat het dashboard van het abonnement nodig heeft, zonder betaalprovider-details. */
export type SubscriptionSummary = {
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  /** Alleen bij status "proef". */
  trialEndsAt?: string | null;
};

/** Alles wat het dashboard in één keer ophaalt. */
export type DashboardOverview = {
  totalProjects: number;
  projectCounts: ProjectStatusCounts;
  recentProjects: ProjectSummary[];
  usage: UsageSummary;
  /** `null` zolang een organisatie nog geen abonnement gekozen heeft. */
  subscription: SubscriptionSummary | null;
};
