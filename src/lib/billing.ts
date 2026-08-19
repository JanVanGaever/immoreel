import type { BadgeVariant } from "@/components/ui/badge";
import type { Plan, PlanId, SubscriptionStatus } from "@/types";

/**
 * Plannen en abonnementsstatussen op één plek: de facturatiepagina toont de
 * volledige lijst, het dashboard alleen het plan van de organisatie.
 * Prijzen zijn nog statisch; de betaalprovider volgt later.
 */

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Voor de zelfstandige makelaar.",
    pricePerMonthInCents: 4900,
    includedRendersPerMonth: 10,
    features: ["1 gebruiker", "10 renders per maand", "Standaard templates"],
  },
  kantoor: {
    id: "kantoor",
    name: "Kantoor",
    description: "Voor een kantoor met meerdere medewerkers.",
    pricePerMonthInCents: 12900,
    includedRendersPerMonth: 40,
    features: ["5 gebruikers", "40 renders per maand", "Eigen huisstijl"],
  },
  groep: {
    id: "groep",
    name: "Groep",
    description: "Voor vastgoedgroepen met meerdere vestigingen.",
    pricePerMonthInCents: 29900,
    includedRendersPerMonth: 150,
    features: ["Onbeperkt gebruikers", "150 renders per maand", "API-toegang"],
  },
};

/** Van klein naar groot, zoals ze op de facturatiepagina staan. */
export const PLAN_LIST: Plan[] = [PLANS.starter, PLANS.kantoor, PLANS.groep];

/** Het plan dat we in de communicatie aanraden. */
export const RECOMMENDED_PLAN_ID: PlanId = "kantoor";

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId];
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  actief: "Actief",
  proef: "Proefperiode",
  opgezegd: "Opgezegd",
  achterstallig: "Betaling openstaand",
};

export const SUBSCRIPTION_STATUS_VARIANTS: Record<SubscriptionStatus, BadgeVariant> = {
  actief: "success",
  proef: "info",
  opgezegd: "neutral",
  achterstallig: "danger",
};

/** Statussen waarbij de gebruiker iets moet doen voor de dienst stopt. */
export function subscriptionNeedsAction(status: SubscriptionStatus): boolean {
  return status === "achterstallig" || status === "opgezegd";
}

/**
 * Wat er naast de renders in een plan zit. Staat los van `Plan` omdat dit
 * later uit de betaalprovider komt; `0` betekent onbeperkt.
 */
export const PLAN_LIMITS: Record<PlanId, { storageInBytes: number; seats: number }> = {
  starter: { storageInBytes: 5 * 1024 ** 3, seats: 1 },
  kantoor: { storageInBytes: 50 * 1024 ** 3, seats: 5 },
  groep: { storageInBytes: 250 * 1024 ** 3, seats: 0 },
};

/** Duur van de proefperiode voor een nieuwe organisatie. */
export const TRIAL_DAYS = 14;
