import { findExport, loadProjectExports } from "@/lib/exports/access";
import { attachmentHeader, openRenderOutput, RenderOutputError } from "@/lib/exports/delivery";

/**
 * Eén afgewerkte export downloaden.
 *
 * De browser krijgt de bytes van ons en niet van de opslag. Dat is de enige
 * manier om drie dingen tegelijk waar te maken: alleen wie erbij mag krijgt het
 * bestand, het heet naar het pand in plaats van naar een opslagsleutel, en de
 * opslag mag morgen een bucket zijn zonder dat de knop op de pagina verandert.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; jobId: string }> },
) {
  const { projectId, jobId } = await params;

  const access = await loadProjectExports(projectId);
  if (!access.ok) return access.response;

  const found = findExport(access.exports, jobId);
  if (!found) return new Response("Onbekende export.", { status: 404 });

  const { job, fileName } = found;

  if (job.status !== "done" || !job.outputUrl) {
    // 409 en geen 404: de export bestaat, ze is alleen nog niet klaar. Een
    // tabblad dat op de knop duwt terwijl de render net herstart is, hoort dat
    // te lezen te krijgen.
    return new Response("Deze export is nog niet klaar.", { status: 409 });
  }

  try {
    const output = await openRenderOutput(job.outputUrl);

    const headers = new Headers({
      "Content-Type": output.contentType,
      "Content-Disposition": attachmentHeader(fileName),
      // De inhoud van een afgewerkte render verandert niet meer: de sleutel is
      // afgeleid van het renderplan (zie `src/lib/render/fingerprint.ts`).
      // Privé, want de rechtencontrole hierboven mag geen gedeelde cache
      // overslaan.
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(output.sizeInBytes ?? job.sizeInBytes ?? ""),
    });

    if (!headers.get("Content-Length")) headers.delete("Content-Length");

    return new Response(output.stream, { headers });
  } catch (error) {
    if (error instanceof RenderOutputError) {
      return new Response(error.message, { status: error.reason === "missing" ? 410 : 502 });
    }

    throw error;
  }
}
