"use server";

import { isApiError } from "@/lib/api/errors";
import { assertPermission } from "@/lib/auth/session";
import type { BrandKitState } from "@/lib/brand/action-state";
import { saveOwnBrandKit } from "@/lib/brand/service";
import type { BrandKitErrors } from "@/lib/brand/validation";
import type { BrandKitInput } from "@/types";

/**
 * De huisstijl bewaren.
 *
 * De pagina laat het formulier al niet versturen met een fout erin, maar wat
 * de browser zegt is een suggestie: rol, rechten en validatie gaan hier
 * opnieuw door de molen. `organisation:manage` is bewust hetzelfde recht als
 * voor de rest van de organisatiegegevens — een editor maakt video's, een
 * eigenaar bepaalt hoe ze eruitzien.
 *
 * Het bewaren zelf staat in `service.ts`, omdat `PUT /api/brand-kit` precies
 * hetzelfde doet.
 */
export async function saveBrandKitAction(input: BrandKitInput): Promise<BrandKitState> {
  const { organisation } = await assertPermission("organisation:manage");

  try {
    const { kit } = await saveOwnBrandKit(organisation.id, input);

    return { status: "opgeslagen", kit, savedAt: kit.updatedAt };
  } catch (error) {
    if (!isApiError(error)) throw error;

    // De velden komen uit `validateBrandKit()`; alleen de lege plekken zijn
    // eruit gehaald.
    return {
      status: "fout",
      message: error.message,
      fieldErrors: error.fields as BrandKitErrors,
    };
  }
}
