import { hasEnoughContrast, isHexColor, normaliseHex } from "@/lib/brand/colors";
import { DEFAULT_FONT_ID, isBrandFontId } from "@/lib/brand/fonts";
import { createBrandKitInput } from "@/lib/brand/kit";
import type { BrandKitInput } from "@/types";

/**
 * Validatie van de huisstijl.
 *
 * Dezelfde functies draaien in het formulier (meteen feedback bij het verlaten
 * van een veld) en in de serveractie (die niets van de browser gelooft) — net
 * als bij de wizard en de auth-formulieren.
 *
 * Er is bewust onderscheid tussen drie soorten reacties:
 *
 * - **Fout** (`validateBrandKit`): dit kan niet bewaard worden. Een kleur die
 *   geen kleur is, een e-mailadres met een spatie erin.
 * - **Waarschuwing** (`brandKitWarnings`): dit mag, maar levert straks een
 *   magere video op. Geen logo, of twee kleuren die op elkaar niet te
 *   onderscheiden zijn.
 * - **Rechttrekken** (`sanitizeBrandKit`): spaties, hoofdletters in een hex,
 *   een lettertype dat niet meer bestaat. Daar hoort geen melding bij.
 */

export type BrandKitField =
  | "logo"
  | "primaryColor"
  | "secondaryColor"
  | "outroText"
  | "ctaText"
  | "agentName"
  | "phone"
  | "email"
  | "website"
  | "fontId";

export type BrandKitErrors = Partial<Record<BrandKitField, string>>;

export const AGENT_NAME_MAX_LENGTH = 60;
/** Wat er nog leesbaar op een staande kaart past; zie `wrapCardText()`. */
export const OUTRO_TEXT_MAX_LENGTH = 70;
export const CTA_TEXT_MAX_LENGTH = 40;

/** Wat een logo mag zijn. PNG met transparantie is wat je eigenlijk wil. */
export const LOGO_CONSTRAINTS = {
  acceptedMimeTypes: ["image/png", "image/svg+xml", "image/jpeg", "image/webp"],
  acceptedExtensions: ["png", "svg", "jpg", "jpeg", "webp"],
  maxBytes: 2 * 1024 * 1024,
  maxFiles: 1,
  label: "PNG, SVG, JPG of WebP",
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** Ruim: Belgische nummers worden op vijf manieren geschreven en alle vijf zijn goed. */
const PHONE_PATTERN = /^\+?[\d\s./()-]{6,20}$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;

export function validateBrandKit(input: BrandKitInput): BrandKitErrors {
  const errors: BrandKitErrors = {};

  const name = input.contact.agentName.trim();
  if (!name) {
    errors.agentName = "Vul de naam in die op de eindkaart komt.";
  } else if (name.length > AGENT_NAME_MAX_LENGTH) {
    errors.agentName = `Hou het onder ${AGENT_NAME_MAX_LENGTH} tekens.`;
  }

  errors.primaryColor = validateColor(input.primaryColor, "de primaire kleur");
  errors.secondaryColor = validateColor(input.secondaryColor, "de secundaire kleur");

  if (input.outroText.trim().length > OUTRO_TEXT_MAX_LENGTH) {
    errors.outroText = `Deze zin past niet op de kaart. Hou het onder ${OUTRO_TEXT_MAX_LENGTH} tekens.`;
  }

  if (input.ctaText.trim().length > CTA_TEXT_MAX_LENGTH) {
    errors.ctaText = `Een call to action werkt kort. Hou het onder ${CTA_TEXT_MAX_LENGTH} tekens.`;
  }

  const phone = input.contact.phone.trim();
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone = "Dit lijkt geen telefoonnummer. Bijvoorbeeld: +32 470 12 34 56.";
  }

  const email = input.contact.email.trim();
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = "Vul een geldig e-mailadres in.";
  }

  const website = input.contact.website.trim();
  if (website && !WEBSITE_PATTERN.test(website)) {
    errors.website = "Vul een geldig webadres in, bijvoorbeeld www.janssens.be.";
  }

  if (!isBrandFontId(input.fontId)) {
    errors.fontId = "Kies een lettertype uit de lijst.";
  }

  return stripEmpty(errors);
}

function validateColor(value: string, label: string): string | undefined {
  if (!value.trim()) return `Kies ${label}.`;
  if (!isHexColor(value)) return "Gebruik een hexcode, bijvoorbeeld #0f5f57.";

  return undefined;
}

export function hasErrors(errors: BrandKitErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/* -------------------------------------------------------------------------
 * Waarschuwingen
 * ---------------------------------------------------------------------- */

export type BrandKitWarning = {
  field: BrandKitField;
  message: string;
};

/**
 * Wat er mag maar beter niet zo blijft. Deze blokkeren het bewaren niet: een
 * kantoor dat zijn logo nog moet laten maken, moet vandaag al kunnen beginnen.
 */
export function brandKitWarnings(input: BrandKitInput): BrandKitWarning[] {
  const warnings: BrandKitWarning[] = [];

  if (!input.logoUrl) {
    warnings.push({
      field: "logo",
      message: "Zonder logo tonen we de initialen van je kantoor in het watermerk.",
    });
  }

  if (
    isHexColor(input.primaryColor) &&
    isHexColor(input.secondaryColor) &&
    !hasEnoughContrast(input.primaryColor, input.secondaryColor)
  ) {
    warnings.push({
      field: "secondaryColor",
      message:
        "Deze twee kleuren lijken te hard op elkaar: de call to action valt straks weg op de eindkaart.",
    });
  }

  if (!input.contact.phone.trim() && !input.contact.email.trim()) {
    warnings.push({
      field: "phone",
      message: "Zonder telefoon of e-mail kan een kijker niets met de eindkaart.",
    });
  }

  return warnings;
}

/* -------------------------------------------------------------------------
 * Rechttrekken
 * ---------------------------------------------------------------------- */

/**
 * Alles in de vorm zetten waarin het bewaard hoort te worden. Draait ná de
 * validatie: wat hier bijgeschaafd wordt, verdient geen melding.
 */
export function sanitizeBrandKit(input: BrandKitInput): BrandKitInput {
  const base = createBrandKitInput(input);

  return {
    ...base,
    logoUrl: base.logoUrl?.trim() || null,
    logoFileName: base.logoFileName?.trim() || null,
    primaryColor: normaliseHex(base.primaryColor) ?? createBrandKitInput().primaryColor,
    secondaryColor: normaliseHex(base.secondaryColor) ?? createBrandKitInput().secondaryColor,
    outroText: base.outroText.trim(),
    ctaText: base.ctaText.trim(),
    contact: {
      agentName: base.contact.agentName.trim(),
      phone: base.contact.phone.trim(),
      email: base.contact.email.trim().toLowerCase(),
      website: base.contact.website.trim().replace(/\/+$/, ""),
    },
    fontId: isBrandFontId(base.fontId) ? base.fontId : DEFAULT_FONT_ID,
    watermarkByDefault: Boolean(base.watermarkByDefault),
  };
}

function stripEmpty(errors: BrandKitErrors): BrandKitErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message)));
}
