import { getProjectAssetStore } from "@/db/project-asset-store";
import { handle, notFound, requireApiSession } from "@/lib/api";
import { RenderOutputError } from "@/lib/exports/delivery";
import { getUploadStorage } from "@/lib/uploads/storage";
import { PHOTO_UPLOAD_CONSTRAINTS, normaliseMimeType } from "@/lib/uploads/validation";

/**
 * Het bestand van één geüploade foto.
 *
 * Dezelfde reden om via de app te gaan als bij de downloads van een render: de
 * opslag is niet publiek, en dat hoort ze ook niet te zijn — foto's van een
 * pand dat nog niet op de markt is, zijn geen openbare bestanden. Wie erbij
 * mag, is wie in dit kantoor mag meekijken.
 *
 * Het antwoord mag wél in de cache van de browser. Een asset-id hoort bij één
 * bestand en dat bestand verandert niet meer: een andere foto is een andere
 * upload en dus een ander id. `private` omdat de rechtencontrole hierboven geen
 * gedeelde cache mag overslaan.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  return handle(async () => {
    const session = await requireApiSession("project:view");
    const { assetId } = await params;

    // Het opzoeken is meteen de controle of deze foto van dit kantoor is.
    const asset = await getProjectAssetStore().findAsset(session.organisation.id, assetId);

    // Zonder sleutel is de upload nooit afgerond; er zijn dan geen bytes om te
    // geven, en dat is hetzelfde als niet bestaan.
    if (!asset?.storageKey) throw notFound("Onbekende foto.");

    // De rij zegt wat er ooit geüpload is; deze lijst zegt wat we bereid zijn
    // terug te sturen. Dat zijn twee dingen, en ze hier weer samen laten vallen
    // is precies hoe een foto een stuk HTML op ons eigen domein werd. Rijen van
    // vóór deze controle kunnen nog een ander mimetype dragen: die krijgen een
    // download in plaats van een weergave.
    const contentType = isServableImage(asset.mimeType) ? asset.mimeType : null;

    try {
      const output = await getUploadStorage().open(
        asset.storageKey,
        contentType ?? "application/octet-stream",
      );

      const headers = new Headers({
        "Content-Type": contentType ?? "application/octet-stream",
        // Inline: dit is een voorbeeld in een uploadlijst, geen download. Alleen
        // voor beeld dat we vertrouwen; al de rest wordt bewust weggeschreven
        // in plaats van getoond.
        "Content-Disposition": contentType ? "inline" : "attachment",
        // Zonder dit mag de browser zelf raden wat dit bestand is, en dan is een
        // `Content-Type` die we net zorgvuldig gekozen hebben niets meer waard.
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400",
      });

      if (output.sizeInBytes !== null) {
        headers.set("Content-Length", String(output.sizeInBytes));
      }

      return new Response(output.stream, { headers });
    } catch (error) {
      // Het bestand stond er wel toen de upload klaar was; nu niet meer. Dat is
      // een opgeruimde map of een verhuisde opslag, en voor wie het opvraagt
      // hetzelfde als een foto die er niet is.
      if (error instanceof RenderOutputError) {
        throw notFound("Dit bestand staat niet meer in de opslag.");
      }

      throw error;
    }
  });
}

/**
 * Mogen we dit type inline terugsturen?
 *
 * Alleen de beeldformaten die de uploadzone ook accepteert. Alles daarbuiten —
 * een rij van vóór deze controle, of iets wat later via een ander pad
 * binnenkomt — wordt een download met `application/octet-stream`, want een
 * onbekend type inline serveren is hoe een upload zich voordoet als een pagina.
 */
function isServableImage(mimeType: string): boolean {
  return PHOTO_UPLOAD_CONSTRAINTS.acceptedMimeTypes.includes(normaliseMimeType(mimeType));
}
