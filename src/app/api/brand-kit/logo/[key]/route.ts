import { handle, notFound, requireApiSession } from "@/lib/api";
import { RenderOutputError } from "@/lib/exports/delivery";
import { getUploadStorage } from "@/lib/uploads/storage";
import { PHOTO_UPLOAD_CONSTRAINTS, normaliseMimeType } from "@/lib/uploads/validation";

/**
 * Het logobestand van een kantoor.
 *
 * Een logo hoort bij de organisatie en niet bij één project, dus het kan niet
 * via `/api/assets/:assetId` — die route zoekt in `project_assets`. Vandaar een
 * eigen adres, met dezelfde afspraken: de opslag is niet publiek, het
 * `Content-Type` komt uit onze eigen lijst en niet uit de rij, en `nosniff`
 * staat erbij.
 *
 * **De sleutel draagt de organisatie.** `importLogo()` schrijft weg als
 * `logo_<organisatie>_<tijd>.png`, en deze route geeft alleen bestanden terug
 * waarvan de sleutel bij het kantoor van de aanvrager hoort. Zonder die regel
 * is dit een lijst waar iedereen doorheen kan grasduinen.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  return handle(async () => {
    const session = await requireApiSession("project:view");
    const { key } = await params;

    // Het opzoeken ís de rechtencontrole, net als bij de projecten: een sleutel
    // van een ander kantoor bestaat hier niet.
    if (!key.startsWith(`logo_${session.organisation.id}_`)) {
      throw notFound("Onbekend logo.");
    }

    const contentType = contentTypeFor(key);
    if (!contentType) throw notFound("Onbekend logo.");

    try {
      const output = await getUploadStorage().open(key, contentType);

      const headers = new Headers({
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        // Een logo onder deze sleutel verandert niet meer: een ander logo is
        // een andere import en dus een andere sleutel.
        "Cache-Control": "private, max-age=86400",
      });

      if (output.sizeInBytes !== null) headers.set("Content-Length", String(output.sizeInBytes));

      return new Response(output.stream, { headers });
    } catch (error) {
      if (error instanceof RenderOutputError) {
        throw notFound("Dit logo staat niet meer in de opslag.");
      }

      throw error;
    }
  });
}

/** Uit de extensie van de sleutel, en alleen als het iets is dat we serveren. */
function contentTypeFor(key: string): string | null {
  const extensie = key.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    avif: "image/avif",
  };

  const type = types[extensie];

  return type && PHOTO_UPLOAD_CONSTRAINTS.acceptedMimeTypes.includes(normaliseMimeType(type))
    ? type
    : null;
}
