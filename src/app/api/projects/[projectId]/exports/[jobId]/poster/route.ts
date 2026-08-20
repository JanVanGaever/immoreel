import { findExport, loadProjectExports } from "@/lib/exports/access";
import { openRenderOutput, RenderOutputError } from "@/lib/exports/delivery";

/**
 * Het posterbeeld van een export: één still uit de afgewerkte video.
 *
 * Zelfde reden om via de app te gaan als bij de download — rechten en opslag —
 * maar met een andere uitkomst wanneer het misgaat. Een ontbrekend posterbeeld
 * is geen fout die iemand moet oplossen; de kaart op de downloadpagina valt dan
 * gewoon terug op haar kleurvlak.
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
  if (!found?.job.posterUrl) return new Response("Geen posterbeeld.", { status: 404 });

  try {
    const output = await openRenderOutput(found.job.posterUrl, "image/jpeg");

    return new Response(output.stream, {
      headers: {
        "Content-Type": output.contentType,
        // Een still uit een afgewerkte render verandert niet meer.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    if (error instanceof RenderOutputError) return new Response(error.message, { status: 404 });

    throw error;
  }
}
