import { loadProjectExports } from "@/lib/exports/access";
import { attachmentHeader, openRenderOutput } from "@/lib/exports/delivery";
import { archiveFileName } from "@/lib/exports/results";
import { createZipStream, type ZipEntry } from "@/lib/exports/zip";

/**
 * Alles in één keer: de afgewerkte exports van dit project als zip.
 *
 * Wie voor één pand naar vijf platformen exporteert, wil geen vijf keer op
 * "Downloaden" duwen en daarna vijf keer bevestigen dat het bestand veilig is.
 *
 * Het archief wordt geschreven terwijl het verstuurd wordt (zie
 * `src/lib/exports/zip.ts`), dus de download begint meteen en de server houdt
 * geen video's in het geheugen. De keerzijde: de totale grootte is bij het
 * eerste byte nog niet bekend, dus er staat geen `Content-Length` bij en de
 * browser toont een download zonder voortgangsbalk. Dat is de prijs voor niet
 * eerst alles inpakken; de pagina zegt daarom vooraf hoeveel het ongeveer wordt.
 *
 * Renders die nog lopen of mislukt zijn, gaan niet mee. Een zip met een half
 * bestand erin is erger dan een zip zonder.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const access = await loadProjectExports(projectId);
  if (!access.ok) return access.response;

  const { project, jobs, results } = access.exports;

  const entries: ZipEntry[] = [];

  for (const result of results) {
    if (!result.isDownloadable) continue;

    const job = jobs.find((candidate) => candidate.id === result.jobId);
    const outputUrl = job?.outputUrl;
    if (!outputUrl) continue;

    entries.push({
      name: result.fileName,
      modifiedAt: result.finishedAt ? new Date(result.finishedAt) : undefined,
      // Pas openen wanneer dit bestand aan de beurt is; anders staan er vijf
      // verbindingen met de opslag open waarvan er vier wachten.
      open: async () => (await openRenderOutput(outputUrl)).stream,
    });
  }

  if (entries.length === 0) {
    return new Response("Er staat nog geen enkele export klaar.", { status: 409 });
  }

  return new Response(createZipStream(entries), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": attachmentHeader(archiveFileName(project.title)),
      // Geen cache: welke exports klaar zijn, verandert terwijl er gerenderd
      // wordt, en dan hoort een tweede klik een vollere zip te geven.
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
