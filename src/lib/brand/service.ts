import { revalidatePath } from "next/cache";
import { getBrandKitStore } from "@/db/brand-kit-store";
import { invalidInput } from "@/lib/api/errors";
import {
  brandKitWarnings,
  hasErrors,
  sanitizeBrandKit,
  validateBrandKit,
  type BrandKitWarning,
} from "@/lib/brand/validation";
import { ROUTES } from "@/lib/constants";
import type { BrandKit, BrandKitInput, ID } from "@/types";

/**
 * De huisstijl bewaren, voor het formulier én voor de API.
 *
 * Eerst de keuring (`validateBrandKit`), dan pas de wasstraat
 * (`sanitizeBrandKit`). Die volgorde doet ertoe: het rechttrekken vervangt een
 * kleur die geen kleur is door de standaardkleur, en wie dat vóór de validatie
 * doet, keurt een waarde goed die de gebruiker nooit ingevuld heeft. Precies
 * het onderscheid dat `lib/brand/validation.ts` maakt tussen "fout" (een
 * hexcode die geen hexcode is) en "rechttrekken" (dezelfde hexcode in
 * hoofdletters).
 *
 * Waarschuwingen houden het bewaren níet tegen — een kantoor dat zijn logo nog
 * moet laten maken, moet vandaag al kunnen beginnen — maar ze gaan wel mee
 * terug, zodat het scherm ze kan tonen.
 */
export type SaveBrandKitResult = {
  kit: BrandKit;
  warnings: BrandKitWarning[];
};

export async function saveOwnBrandKit(
  organisationId: ID,
  input: BrandKitInput,
): Promise<SaveBrandKitResult> {
  const fieldErrors = validateBrandKit(input);

  if (hasErrors(fieldErrors)) {
    throw invalidInput(
      "Er ontbreekt nog iets. Kijk de gemarkeerde velden na.",
      stripEmpty(fieldErrors),
    );
  }

  const kit = await getBrandKitStore().saveBrandKit(organisationId, sanitizeBrandKit(input));

  // De huisstijl ligt over elk project heen: de editor leest ze bij het laden,
  // en de instellingenpagina toont ze samengevat.
  revalidatePath(ROUTES.settings);
  revalidatePath(ROUTES.brandKit);
  revalidatePath(ROUTES.projects);

  return { kit, warnings: brandKitWarnings(kit) };
}

function stripEmpty(errors: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
