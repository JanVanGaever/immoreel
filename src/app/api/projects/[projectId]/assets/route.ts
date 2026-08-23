import { handle, jsonCreated, jsonOk, readFormFiles, requireApiSession } from "@/lib/api";
import { API_ROUTES } from "@/lib/constants";
import { listProjectAssets, uploadProjectAssets } from "@/lib/projects/assets";

/**
 * De foto's van een project: opsommen en uploaden.
 *
 * De upload is `multipart/form-data` en geen JSON met base64 erin. Dat scheelt
 * een derde aan bytes over de lijn, maar vooral: het is de enige vorm waarbij
 * de browser voortgang kan melden terwijl er verstuurd wordt (zie
 * `createXhrTransport` in `src/lib/uploads/transport.ts`), en een
 * uploadbalk zonder echte voortgang is een animatie.
 *
 * Elke foto die erdoor komt, krijgt meteen een scène achteraan de tijdlijn: wie
 * foto's toevoegt aan een project, bedoelt dat ze in de video komen. Wat
 * geweigerd wordt — verkeerd formaat, te groot, meer dan de veertig die in een
 * pandvideo passen — komt terug in `rejected`, met de reden erbij. Eén
 * bestand dat niet mag, maakt de andere negentien dus niet stuk.
 *
 * Met `?scenes=none` blijft de tijdlijn onaangeroerd en komen er alleen assets
 * bij. Dat is wat de editor stuurt: die heeft zijn scène al gemaakt op het
 * moment dat de foto in de sleepzone viel. Zie `uploadProjectAssets()` voor
 * waarom er maar één eigenaar van de tijdlijn mag zijn.
 *
 * De keuze staat in de URL en niet in het formulier, omdat `readFormFiles()`
 * alleen bestanden overhoudt: een veld naast de foto's komt hier nooit aan.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const session = await requireApiSession("project:view");
    const { projectId } = await params;
    const assets = await listProjectAssets(session.organisation.id, projectId);

    return jsonOk({ assets });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const session = await requireApiSession("media:upload");
    const { projectId } = await params;

    const { assets, rejected, project } = await uploadProjectAssets({
      organisationId: session.organisation.id,
      userId: session.user.id,
      projectId,
      files: await readFormFiles(request),
      attachScenes: new URL(request.url).searchParams.get("scenes") !== "none",
    });

    const single = assets.length === 1 ? assets[0] : null;

    return jsonCreated(
      {
        assets,
        rejected,
        // Het project gaat mee omdat de tijdlijn zonet veranderd is: zo hoeft
        // de client hem niet meteen opnieuw op te halen om zijn scènes te
        // kennen.
        project,
        // Eén bestand tegelijk is wat de uploadtransport in de browser doet, en
        // die leest `id` en `url` uit het antwoord. Vandaar deze twee velden
        // naast de lijst: dan werkt dezelfde route voor een uploadzone én voor
        // een script dat er twintig ineens instuurt.
        ...(single ? { id: single.id, url: API_ROUTES.asset(single.id) } : {}),
      },
      single ? API_ROUTES.asset(single.id) : API_ROUTES.projectAssets(projectId),
    );
  });
}
