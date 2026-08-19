import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "@/lib/constants";
import type { DashboardOverview, UsageSummary } from "@/types";

/**
 * Afleidingen op de dashboarddata. Bewust apart van de store: dit rekenwerk
 * blijft gelijk of de cijfers nu uit mockdata of uit een databank komen.
 */

/** Vanaf welk aandeel van het inbegrepen volume we waarschuwen. */
const USAGE_WARNING_RATIO = 0.8;

export type UsageTone = "brand" | "warning" | "danger";

/** 0 als er geen limiet is; verder een waarde tussen 0 en 1. */
export function usageRatio(used: number, included: number): number {
  if (included <= 0) return 0;
  return Math.min(used / included, 1);
}

export function usageTone(used: number, included: number): UsageTone {
  if (included > 0 && used >= included) return "danger";
  if (included > 0 && used / included >= USAGE_WARNING_RATIO) return "warning";
  return "brand";
}

/** Hoeveel er nog over is; nooit negatief. */
export function remaining(used: number, included: number): number {
  return Math.max(included - used, 0);
}

/** Hele dagen tot een datum. Negatief als de datum voorbij is. */
export function daysUntil(value: string | Date, from: Date = new Date()): number {
  const target = new Date(value).getTime();
  return Math.ceil((target - from.getTime()) / 86_400_000);
}

/** "augustus 2026" — de periode waarover het verbruik gaat. */
export function formatPeriodLabel(usage: UsageSummary): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(usage.periodStart));
}

/**
 * Een organisatie zonder projecten krijgt de onboarding te zien in plaats van
 * lege lijsten en nullen.
 */
export function isNewOrganisation(overview: DashboardOverview): boolean {
  return overview.totalProjects === 0;
}

/**
 * Tegenhanger van `usageTone` voor capaciteit in plaats van verbruik: vol
 * zitten is hier normaal (een starter met één gebruiker gebruikt zijn ene
 * plaats), alleen eroverheen gaan is een probleem.
 */
export function capacityTone(used: number, included: number): UsageTone {
  return included > 0 && used > included ? "danger" : "brand";
}
