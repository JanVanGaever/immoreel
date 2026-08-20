"use server";

import { revalidatePath } from "next/cache";
import { getBrandKitStore } from "@/db/brand-kit-store";
import { assertPermission } from "@/lib/auth/session";
import type { BrandKitState } from "@/lib/brand/action-state";
import { hasErrors, sanitizeBrandKit, validateBrandKit } from "@/lib/brand/validation";
import { ROUTES } from "@/lib/constants";
import type { BrandKitInput } from "@/types";

/**
 * De huisstijl bewaren.
 *
 * De pagina laat het formulier al niet versturen met een fout erin, maar wat
 * de browser zegt is een suggestie: rol, rechten en validatie gaan hier
 * opnieuw door de molen. `organisation:manage` is bewust hetzelfde recht als
 * voor de rest van de organisatiegegevens — een editor maakt video's, een
 * eigenaar bepaalt hoe ze eruitzien.
 */
export async function saveBrandKitAction(input: BrandKitInput): Promise<BrandKitState> {
  const { organisation } = await assertPermission("organisation:manage");

  const sanitized = sanitizeBrandKit(input);
  const fieldErrors = validateBrandKit(sanitized);

  if (hasErrors(fieldErrors)) {
    return {
      status: "fout",
      message: "Er ontbreekt nog iets. Kijk de gemarkeerde velden na.",
      fieldErrors,
    };
  }

  const kit = await getBrandKitStore().saveBrandKit(organisation.id, sanitized);

  // De huisstijl ligt over elk project heen: de editor leest ze bij het laden,
  // en de instellingenpagina toont ze samengevat.
  revalidatePath(ROUTES.settings);
  revalidatePath(ROUTES.brandKit);
  revalidatePath(ROUTES.projects);

  return { status: "opgeslagen", kit, savedAt: kit.updatedAt };
}
