import { getBrandKitStore } from "@/db/brand-kit-store";
import { handle, jsonOk, readJsonObject, requireApiSession } from "@/lib/api";
import { readBrandKitInput } from "@/lib/brand/input";
import { saveOwnBrandKit } from "@/lib/brand/service";
import { brandKitWarnings } from "@/lib/brand/validation";

/**
 * De huisstijl van het kantoor: lezen en wijzigen.
 *
 * Eén kit per organisatie, dus geen id in het pad. Er is altijd een antwoord —
 * een kantoor dat nog nooit iets ingesteld heeft, krijgt de standaardkit — want
 * `null` teruggeven zou betekenen dat elke preview en elke render moet nadenken
 * over "wat als er geen huisstijl is".
 *
 * Lezen mag iedereen die in het kantoor werkt: de editor heeft de kit nodig om
 * een preview te tekenen. Wijzigen is `organisation:manage`, en dat is bewust
 * hetzelfde recht als voor de rest van de organisatiegegevens — een editor
 * maakt video's, een eigenaar bepaalt hoe ze eruitzien.
 *
 * `PUT` met een deel van de kit erin: wat je meestuurt verandert, de rest blijft.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireApiSession("project:view");
    const kit = await getBrandKitStore().getBrandKit(session.organisation.id);

    // De waarschuwingen gaan mee bij het lezen én bij het bewaren: een kit
    // zonder logo is geen fout, maar het scherm hoort het te zeggen.
    return jsonOk({ kit, warnings: brandKitWarnings(kit) });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const session = await requireApiSession("organisation:manage");
    const current = await getBrandKitStore().getBrandKit(session.organisation.id);
    const input = readBrandKitInput(await readJsonObject(request), current);

    return jsonOk(await saveOwnBrandKit(session.organisation.id, input));
  });
}
