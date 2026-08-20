import { handle, jsonOk, readJsonObject, requireApiSession } from "@/lib/api";
import { reorderProjectAssets } from "@/lib/projects/assets";
import { readAssetOrder } from "@/lib/projects/input";

/**
 * De volgorde van de foto's bewaren.
 *
 * Het lichaam is de volledige rij en niets anders:
 *
 * ```json
 * { "assetIds": ["ast_a1", "ast_b2", "ast_c3"] }
 * ```
 *
 * Geen `{ assetId, position }`-paren, geen "verplaats deze naar plek 2". Een
 * volledige rij is idempotent — twee keer versturen geeft twee keer hetzelfde —
 * en er is geen tussentoestand waarin twee foto's dezelfde plek claimen. Klopt
 * de rij niet meer met wat er in het project staat, dan is de client verouderd
 * en krijgt hij een 409 in plaats van een volgorde die niemand bedoeld heeft.
 *
 * De scènes schuiven mee, met hun instellingen. Een herschikking mag geen
 * beweging, duur of bijschrift wissen.
 *
 * Een eigen route en geen `PATCH` op het project: dit is de handeling die het
 * vaakst gebeurt terwijl er verder niets verandert (slepen in de tijdlijn), en
 * ze mag niet per ongeluk half naast een titelwijziging landen.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const session = await requireApiSession("project:edit");
    const { projectId } = await params;
    const assetIds = readAssetOrder(await readJsonObject(request));

    const { assets, project } = await reorderProjectAssets({
      organisationId: session.organisation.id,
      projectId,
      assetIds,
    });

    return jsonOk({ assets, project });
  });
}
