import type { BrandingSettings, ID, LogoPlacement } from "@/types";

/**
 * De huisstijlkeuzes in de editor.
 *
 * Een echte huisstijl (logo, kleuren, lettertype) hoort bij de organisatie en
 * komt later uit een `BrandKitStore` — vandaar dat `listBrandKits()` hier een
 * vaste lijst teruggeeft en niet een import van een store. De vorm klopt wel
 * al: het project bewaart alleen het id van de kit plus wat het ervan gebruikt.
 */

export type BrandKit = {
  id: ID;
  name: string;
  description: string;
  /** Hex, zoals die in de video gebruikt wordt. */
  accentColor: string;
  /** Tekstkleur op dat accent, zodat een titelkaart leesbaar blijft. */
  onAccentColor: string;
  /** Placeholder zolang er geen echt logo geüpload is. */
  logoInitials: string;
};

const BRAND_KITS: BrandKit[] = [
  {
    id: "kit_immoreel",
    name: "Immoreel (standaard)",
    description: "Petrol en wit. Neutraal genoeg voor elk pand.",
    accentColor: "#0f5f57",
    onAccentColor: "#ffffff",
    logoInitials: "IM",
  },
  {
    id: "kit_warm",
    name: "Warm goud",
    description: "Donkere kaarten met een gouden accent. Past bij het duurdere segment.",
    accentColor: "#a4762a",
    onAccentColor: "#1a1206",
    logoInitials: "AG",
  },
  {
    id: "kit_helder",
    name: "Helder blauw",
    description: "Fris en zakelijk; werkt goed op LinkedIn.",
    accentColor: "#175cd3",
    onAccentColor: "#ffffff",
    logoInitials: "HB",
  },
  {
    id: "kit_zwartwit",
    name: "Zwart-wit",
    description: "Geen kleur, alleen typografie. Laat de foto's het werk doen.",
    accentColor: "#101828",
    onAccentColor: "#ffffff",
    logoInitials: "ZW",
  },
];

/** TODO: vervangen door de kits van de organisatie zodra die bewaard worden. */
export function listBrandKits(): BrandKit[] {
  return BRAND_KITS;
}

export function findBrandKit(brandKitId: ID | null | undefined): BrandKit | null {
  if (!brandKitId) return null;

  return BRAND_KITS.find((kit) => kit.id === brandKitId) ?? null;
}

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
  brandKitId: "kit_immoreel",
  logoPlacement: "rechtsonder",
  showContactCard: true,
  showPriceBadge: false,
  accentColor: null,
  agentName: null,
  agentPhone: null,
};

export function createBranding(overrides: Partial<BrandingSettings> = {}): BrandingSettings {
  return { ...DEFAULT_BRANDING, ...overrides };
}

/** De kleur die de video krijgt: eigen keuze eerst, anders die van de kit. */
export function resolveAccentColor(branding: BrandingSettings): string {
  return branding.accentColor ?? findBrandKit(branding.brandKitId)?.accentColor ?? "#0f5f57";
}
