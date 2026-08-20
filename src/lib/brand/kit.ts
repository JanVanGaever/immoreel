import { onColor } from "@/lib/brand/colors";
import { DEFAULT_FONT_ID, fontStack } from "@/lib/brand/fonts";
import { initials } from "@/lib/format";
import type {
  BrandContact,
  BrandFontId,
  BrandKit,
  BrandKitInput,
  BrandingSettings,
  ID,
  ResolvedBrand,
} from "@/types";

/**
 * De huisstijl van een kantoor: wat er standaard in staat, en hoe een project
 * er van afwijkt.
 *
 * Alles hier is puur. Dezelfde functies draaien in het instellingenformulier
 * (live preview), in de editor (preview van dit project) en in de
 * renderpijplijn (de kaart die FFmpeg tekent). Daarom klopt wat je ziet met
 * wat je krijgt: er is maar één plek waar "welke kleur wordt dit dan" wordt
 * beantwoord.
 */

export const DEFAULT_PRIMARY_COLOR = "#0f5f57";
export const DEFAULT_SECONDARY_COLOR = "#c8a45c";

/** Wat een kantoor krijgt voor het zelf iets invult. */
export const DEFAULT_BRAND_KIT: BrandKitInput = {
  logoUrl: null,
  logoFileName: null,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  secondaryColor: DEFAULT_SECONDARY_COLOR,
  outroText: "Benieuwd naar dit pand?",
  ctaText: "Bel voor een bezichtiging",
  contact: { agentName: "", phone: "", email: "", website: "" },
  fontId: DEFAULT_FONT_ID,
  watermarkByDefault: true,
};

export function createBrandKitInput(overrides: Partial<BrandKitInput> = {}): BrandKitInput {
  return {
    ...DEFAULT_BRAND_KIT,
    ...overrides,
    contact: { ...DEFAULT_BRAND_KIT.contact, ...overrides.contact },
  };
}

/** Een verse kit voor een organisatie die er nog geen heeft. */
export function createBrandKit(
  organisationId: ID,
  overrides: Partial<BrandKitInput> = {},
): BrandKit {
  const now = new Date().toISOString();

  return {
    id: `brk_${organisationId}`,
    organisationId,
    ...createBrandKitInput(overrides),
    createdAt: now,
    updatedAt: now,
  };
}

/* -------------------------------------------------------------------------
 * Startpunten
 * ---------------------------------------------------------------------- */

/**
 * Kleurcombinaties om mee te beginnen.
 *
 * Dit zijn geen kits die je kiest en waar je aan vastzit: een klik zet de twee
 * kleuren en het lettertype, daarna is alles nog gewoon aanpasbaar. Een
 * kantoor met een eigen merk overschrijft ze meteen; een kantoor zonder
 * ontwerper begint niet bij een leeg kleurenveld.
 */
export type BrandPreset = {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  fontId: BrandFontId;
};

export const BRAND_PRESETS: BrandPreset[] = [
  {
    id: "petrol",
    name: "Petrol",
    description: "Neutraal genoeg voor elk pand.",
    primaryColor: DEFAULT_PRIMARY_COLOR,
    secondaryColor: "#e7c98a",
    fontId: "inter",
  },
  {
    id: "goud",
    name: "Warm goud",
    description: "Donker met een gouden accent; het duurdere segment.",
    primaryColor: "#1a1206",
    secondaryColor: "#a4762a",
    fontId: "libre-baskerville",
  },
  {
    id: "blauw",
    name: "Helder blauw",
    description: "Fris en zakelijk; werkt goed op LinkedIn.",
    primaryColor: "#175cd3",
    secondaryColor: "#a8ddff",
    fontId: "dm-sans",
  },
  {
    id: "zwartwit",
    name: "Zwart-wit",
    description: "Geen kleur, alleen typografie.",
    primaryColor: "#101828",
    secondaryColor: "#f2f4f7",
    fontId: "space-grotesk",
  },
];

/* -------------------------------------------------------------------------
 * Kit + project
 * ---------------------------------------------------------------------- */

/**
 * De kit en de afwijkingen van het project over elkaar leggen.
 *
 * Overal waar het project `null` laat staan, wint de kit. Dat is de hele regel
 * — en de reden dat een nieuwe huisstijlkleur meteen in bestaande projecten
 * zichtbaar is, behalve in die waar iemand bewust iets anders koos.
 *
 * `branding` mag ontbreken: dan is dit de kit zoals ze op de instellingenpagina
 * getoond wordt, zonder project eromheen.
 */
export function resolveBrand(
  kit: BrandKit,
  branding?: BrandingSettings | null,
): ResolvedBrand {
  const primaryColor = branding?.accentColor ?? kit.primaryColor;
  const secondaryColor = branding?.secondaryColor ?? kit.secondaryColor;
  const fontId = branding?.fontId ?? kit.fontId;

  const contact: BrandContact = {
    agentName: branding?.agentName ?? kit.contact.agentName,
    phone: branding?.agentPhone ?? kit.contact.phone,
    email: branding?.agentEmail ?? kit.contact.email,
    website: kit.contact.website,
  };

  return {
    logoUrl: kit.logoUrl,
    logoInitials: brandInitials(contact.agentName),
    primaryColor,
    secondaryColor,
    onPrimaryColor: onColor(primaryColor),
    onSecondaryColor: onColor(secondaryColor),
    outroText: branding?.outroText ?? kit.outroText,
    ctaText: branding?.ctaText ?? kit.ctaText,
    contact,
    fontId,
    fontStack: fontStack(fontId),
    showWatermark: branding?.showWatermark ?? kit.watermarkByDefault,
  };
}

/** Twee letters voor het vlakje dat het logo vervangt zolang er geen bestand is. */
export function brandInitials(name: string): string {
  return initials(name.trim()) || "IM";
}

/**
 * De regels onder de oproep, in de volgorde waarin ze op de kaart komen. Lege
 * velden verdwijnen: een kantoor zonder website hoort geen lege regel te
 * krijgen, en de kaart schuift gewoon dichter op elkaar.
 */
export function contactLines(brand: ResolvedBrand): string[] {
  return [brand.contact.phone, brand.contact.email, brand.contact.website]
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Of deze eindkaart iets te vertellen heeft. Is alles leeg, dan is het een
 * gekleurd vlak van drie seconden — dat is het bekijken niet waard, en de
 * editor waarschuwt ervoor.
 */
export function hasEndCardContent(brand: ResolvedBrand): boolean {
  return Boolean(
    brand.outroText.trim() ||
      brand.ctaText.trim() ||
      brand.contact.agentName.trim() ||
      contactLines(brand).length > 0,
  );
}

/** Welke velden dit project anders zet dan de huisstijl. Voor "3 afwijkingen". */
export function overriddenFields(branding: BrandingSettings): string[] {
  const fields: [string, unknown][] = [
    ["Primaire kleur", branding.accentColor],
    ["Secundaire kleur", branding.secondaryColor],
    ["Outrotekst", branding.outroText],
    ["Call to action", branding.ctaText],
    ["Lettertype", branding.fontId],
    ["Watermerk", branding.showWatermark],
    ["Naam", branding.agentName],
    ["Telefoon", branding.agentPhone],
    ["E-mail", branding.agentEmail],
  ];

  return fields.filter(([, value]) => value !== null).map(([label]) => label);
}
