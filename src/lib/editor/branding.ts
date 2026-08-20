import type { BrandingSettings, LogoPlacement } from "@/types";

/**
 * De huisstijlkeuzes van één project.
 *
 * De huisstijl zelf — logo, kleuren, teksten, lettertype — hoort bij de
 * organisatie en staat in `src/lib/brand/`. Wat hier staat is wat een project
 * daar bovenop legt: waar het logo komt, of de slotkaart mee moet, en de
 * velden waarin dit ene pand van het kantoor afwijkt.
 *
 * Alles wat overrulebaar is, begint op `null`. Dat is geen lege waarde maar
 * een verwijzing: "neem wat de huisstijl zegt". Een kantoor dat volgende maand
 * zijn kleuren vernieuwt, ziet dat daardoor in al zijn projecten terug —
 * behalve in die waar iemand bewust iets anders koos.
 */

export type LogoPlacementOption = {
  id: LogoPlacement;
  label: string;
  /** Positie in de preview, als CSS-klassen. */
  className: string;
};

export const LOGO_PLACEMENTS: LogoPlacementOption[] = [
  { id: "geen", label: "Geen logo", className: "hidden" },
  { id: "linksboven", label: "Linksboven", className: "top-[4%] left-[4%]" },
  { id: "rechtsboven", label: "Rechtsboven", className: "top-[4%] right-[4%]" },
  { id: "linksonder", label: "Linksonder", className: "bottom-[4%] left-[4%]" },
  { id: "rechtsonder", label: "Rechtsonder", className: "bottom-[4%] right-[4%]" },
];

export function logoPlacementClassName(placement: LogoPlacement): string {
  return LOGO_PLACEMENTS.find((option) => option.id === placement)?.className ?? "hidden";
}

export const DEFAULT_BRANDING: BrandingSettings = {
  logoPlacement: "rechtsonder",
  showContactCard: true,
  showPriceBadge: false,
  accentColor: null,
  secondaryColor: null,
  outroText: null,
  ctaText: null,
  fontId: null,
  showWatermark: null,
  agentName: null,
  agentPhone: null,
  agentEmail: null,
};

export function createBranding(overrides: Partial<BrandingSettings> = {}): BrandingSettings {
  return { ...DEFAULT_BRANDING, ...overrides };
}

/** Zet alle afwijkingen terug: het project volgt de huisstijl weer volledig. */
export function clearBrandOverrides(branding: BrandingSettings): BrandingSettings {
  return {
    ...branding,
    accentColor: null,
    secondaryColor: null,
    outroText: null,
    ctaText: null,
    fontId: null,
    showWatermark: null,
    agentName: null,
    agentPhone: null,
    agentEmail: null,
  };
}
