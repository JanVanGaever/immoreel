import { InputReader } from "@/lib/api/input";
import { invalidInput } from "@/lib/api/errors";
import { BRAND_FONTS } from "@/lib/brand/fonts";
import { createBrandKitInput } from "@/lib/brand/kit";
import {
  AGENT_NAME_MAX_LENGTH,
  CTA_TEXT_MAX_LENGTH,
  OUTRO_TEXT_MAX_LENGTH,
} from "@/lib/brand/validation";
import type { BrandKit, BrandKitInput } from "@/types";

/**
 * Het lichaam van `PUT /api/brand-kit`, gelegd op de huisstijl die er al is.
 *
 * Alles is optioneel: een kantoor dat alleen zijn accentkleur wijzigt, hoeft
 * zijn contactblok niet mee te sturen. Dat is niet alleen gemak — het voorkomt
 * dat een client die één veld kent, per ongeluk de rest leegmaakt.
 *
 * Alleen de vorm wordt hier gecontroleerd. Of een kleur een kleur is en of het
 * e-mailadres ergens op slaat, beslist `validateBrandKit()` verderop: dezelfde
 * functie als het formulier op `/settings/brand-kit` gebruikt.
 */
export function readBrandKitInput(body: Record<string, unknown>, current: BrandKit): BrandKitInput {
  const reader = new InputReader(body);
  const changes: Partial<BrandKitInput> = {};

  if (reader.has("logoUrl")) changes.logoUrl = reader.nullableText("logoUrl", { max: 500 }) ?? null;
  if (reader.has("logoFileName")) {
    changes.logoFileName = reader.nullableText("logoFileName", { max: 255 }) ?? null;
  }
  if (reader.has("primaryColor")) changes.primaryColor = reader.requiredText("primaryColor");
  if (reader.has("secondaryColor")) changes.secondaryColor = reader.requiredText("secondaryColor");
  if (reader.has("outroText")) {
    changes.outroText = reader.text("outroText", { max: OUTRO_TEXT_MAX_LENGTH }) ?? "";
  }
  if (reader.has("ctaText")) {
    changes.ctaText = reader.text("ctaText", { max: CTA_TEXT_MAX_LENGTH }) ?? "";
  }
  if (reader.has("fontId")) {
    changes.fontId = reader.requiredChoice(
      "fontId",
      BRAND_FONTS.map((font) => font.id),
    );
  }
  if (reader.has("watermarkByDefault")) {
    changes.watermarkByDefault = reader.boolean("watermarkByDefault");
  }

  if (reader.has("contact")) {
    changes.contact = reader.object("contact", (contact) => ({
      agentName: contact.text("agentName", { max: AGENT_NAME_MAX_LENGTH }) ?? current.contact.agentName,
      phone: contact.text("phone", { max: 30 }) ?? current.contact.phone,
      email: contact.text("email", { max: 120 }) ?? current.contact.email,
      website: contact.text("website", { max: 200 }) ?? current.contact.website,
    }));
  }

  reader.done();

  if (Object.keys(changes).length === 0) {
    throw invalidInput("Er staat niets in dit verzoek om te wijzigen.");
  }

  // `createBrandKitInput` legt de wijziging op de bestaande kit en vult aan met
  // de standaardwaarden; het contactblok gaat er als geheel in of niet.
  return createBrandKitInput({ ...toInput(current), ...changes });
}

/**
 * De kit zonder wat de server zelf invult: id, organisatie, tijdstempels. Veld
 * voor veld, zodat er bij een nieuw veld in `BrandKit` een keuze gemaakt moet
 * worden in plaats van dat het stilzwijgend meelift.
 */
function toInput(kit: BrandKit): BrandKitInput {
  return {
    logoUrl: kit.logoUrl,
    logoFileName: kit.logoFileName,
    primaryColor: kit.primaryColor,
    secondaryColor: kit.secondaryColor,
    outroText: kit.outroText,
    ctaText: kit.ctaText,
    contact: kit.contact,
    fontId: kit.fontId,
    watermarkByDefault: kit.watermarkByDefault,
  };
}
