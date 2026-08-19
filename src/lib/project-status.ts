import { CircleCheck, CircleDashed, Clock, Loader, Pencil, TriangleAlert, type LucideIcon } from "lucide-react";
import type { BadgeVariant } from "@/components/ui/badge";
import type { ProjectStatus } from "@/types";

/**
 * Eén bron van waarheid voor hoe een projectstatus eruitziet. De lijst, de
 * badge en de statusstrook op het dashboard lezen allemaal hieruit, zodat
 * "renderen" overal dezelfde kleur en hetzelfde woord krijgt.
 */

/** Volgorde zoals een project door de flow loopt; ook de volgorde in de UI. */
export const PROJECT_STATUS_ORDER: readonly ProjectStatus[] = [
  "concept",
  "in-bewerking",
  "wachtrij",
  "renderen",
  "klaar",
  "mislukt",
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  concept: "Concept",
  "in-bewerking": "In bewerking",
  wachtrij: "In wachtrij",
  renderen: "Renderen",
  klaar: "Klaar",
  mislukt: "Mislukt",
};

export const PROJECT_STATUS_DESCRIPTIONS: Record<ProjectStatus, string> = {
  concept: "Aangemaakt, nog geen media toegevoegd.",
  "in-bewerking": "Wordt gemonteerd in de editor.",
  wachtrij: "Wacht tot een worker vrij is.",
  renderen: "De video wordt nu opgebouwd.",
  klaar: "Klaar om te downloaden of te delen.",
  mislukt: "De render is afgebroken met een fout.",
};

export const PROJECT_STATUS_VARIANTS: Record<ProjectStatus, BadgeVariant> = {
  concept: "neutral",
  "in-bewerking": "info",
  wachtrij: "warning",
  renderen: "brand",
  klaar: "success",
  mislukt: "danger",
};

export const PROJECT_STATUS_ICONS: Record<ProjectStatus, LucideIcon> = {
  concept: CircleDashed,
  "in-bewerking": Pencil,
  wachtrij: Clock,
  renderen: Loader,
  klaar: CircleCheck,
  mislukt: TriangleAlert,
};

/** Een lege telling; handig als vertrekpunt bij het optellen van projecten. */
export function emptyStatusCounts(): Record<ProjectStatus, number> {
  return {
    concept: 0,
    "in-bewerking": 0,
    wachtrij: 0,
    renderen: 0,
    klaar: 0,
    mislukt: 0,
  };
}

/** Statussen die op het dashboard vragen om actie van de gebruiker. */
export function needsAttention(status: ProjectStatus): boolean {
  return status === "mislukt";
}
