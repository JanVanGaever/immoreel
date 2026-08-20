import { getRenderJobStore } from "@/db/render-job-store";
import { handle, jsonOk, notFound, requireApiSession } from "@/lib/api";
import { loadOwnProject } from "@/lib/projects/service";
import { toRenderJobSnapshot } from "@/lib/render/status";

/**
 * De stand van één render.
 *
 * Wie op één export wacht — een script dat pas verder mag als het bestand er
 * is — hoeft niet de hele lijst van het project te pollen. Het antwoord is
 * dezelfde `RenderJobSnapshot` als in de lijst en in de eventstroom: één vorm
 * voor alle drie de manieren om ernaar te kijken.
 *
 * Deze route ligt naast `renders/stream`, en dat botst niet: `stream` is een
 * vast pad en gaat voor. Een jobid ziet er sowieso anders uit — het is een
 * afgeleide hash met `rj_` ervoor (zie `src/lib/render/fingerprint.ts`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; jobId: string }> },
) {
  return handle(async () => {
    const session = await requireApiSession("project:view");
    const { projectId, jobId } = await params;
    const organisationId = session.organisation.id;

    // Eerst het project: dat is de controle of dit kantoor hier iets te zoeken
    // heeft. Een jobid alleen zegt niets.
    await loadOwnProject(organisationId, projectId);

    const job = await getRenderJobStore().find(jobId);

    if (!job || job.organisationId !== organisationId || job.projectId !== projectId) {
      throw notFound("Onbekende render.");
    }

    return jsonOk({ job: toRenderJobSnapshot(job) });
  });
}
