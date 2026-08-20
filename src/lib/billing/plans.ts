import type { Plan, PlanId } from "@/types";

/**
 * De plannen en wat ze kosten.
 *
 * Prijzen staan exclusief btw. Dat is geen boekhoudkundig detail maar wat een
 * Belgisch kantoor verwacht te zien: een makelaar rekent de btw terug, dus
 * €129 is de prijs en €156,09 is wat er van de rekening gaat. Beide bedragen
 * horen op het scherm, en `grossPriceInCents()` is de enige plek waar het ene
 * het andere wordt.
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

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS;
}

/** Hoger is groter. Bepaalt of een wissel een upgrade of een downgrade is. */
export function planRank(planId: PlanId): number {
  return PLAN_LIST.findIndex((plan) => plan.id === planId);
}

/**
 * Wat er naast de renders in een plan zit. Staat los van `Plan` omdat dit over
 * grenzen gaat en niet over de prijs; `0` betekent onbeperkt.
 */
export const PLAN_LIMITS: Record<PlanId, { storageInBytes: number; seats: number }> = {
  starter: { storageInBytes: 5 * 1024 ** 3, seats: 1 },
  kantoor: { storageInBytes: 50 * 1024 ** 3, seats: 5 },
  groep: { storageInBytes: 250 * 1024 ** 3, seats: 0 },
};

/** Duur van de proefperiode voor een nieuwe organisatie. */
export const TRIAL_DAYS = 14;

/* -------------------------------------------------------------------------
 * Btw
 * ---------------------------------------------------------------------- */

/** Het Belgische standaardtarief. Software valt niet onder een verlaagd tarief. */
export const VAT_RATE = 0.21;

export function vatInCents(subtotalInCents: number): number {
  return Math.round(subtotalInCents * VAT_RATE);
}

/** Wat er effectief van de rekening gaat: prijs plus btw. */
export function grossPriceInCents(subtotalInCents: number): number {
  return subtotalInCents + vatInCents(subtotalInCents);
}

export type PriceBreakdown = {
  subtotalInCents: number;
  vatInCents: number;
  totalInCents: number;
  vatRate: number;
};

export function priceBreakdown(subtotalInCents: number): PriceBreakdown {
  const vat = vatInCents(subtotalInCents);

  return {
    subtotalInCents,
    vatInCents: vat,
    totalInCents: subtotalInCents + vat,
    vatRate: VAT_RATE,
  };
}
