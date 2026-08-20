import { getRenderJobStore } from "@/db/render-job-store";
import { handle, jsonOk, requireApiSession } from "@/lib/api";
import { API_ROUTES } from "@/lib/constants";
import { buildExportResults, summariseExports } from "@/lib/exports";
import { loadOwnProject } from "@/lib/projects/service";
import { toRenderJobSnapshot } from "@/lib/render/status";

/**
 * Wat er van dit project te downloaden valt.
 *
 * De bestanden zelf komen uit de routes hieronder — `[jobId]/download`,
 * `[jobId]/poster` en `zip` — en die geven bytes. Dit is het overzicht ervoor:
 * per platform de laatste export, hoe ver ze staat, hoe ze straks heet, en waar
 * ze te halen is. Zonder deze route zou een client die links zelf moeten
 * samenstellen uit jobids, en dan bestaat de bestandsnaam op twee plekken.
 *
 * Per platform staat er één export in de lijst, de nieuwste. Een tweede poging
 * na een fout is voor ons een nieuwe job, maar voor de makelaar dezelfde
 * export — zie `buildExportResults`.
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
    const organisationId = session.organisation.id;

    const project = await loadOwnProject(organisationId, projectId);
    const jobs = await getRenderJobStore().listForProject(organisationId, projectId);
    const results = buildExportResults(jobs.map(toRenderJobSnapshot), project);
    const overview = summariseExports(results);

    return jsonOk({
      projectId,
      status: project.status,
      overview,
      exports: results.map((result) => ({
        ...result,
        // Alleen een link als er ook echt iets achter zit: een knop die een 409
        // geeft, is een knop die er niet had moeten staan.
        downloadUrl: result.isDownloadable
          ? API_ROUTES.exportDownload(projectId, result.jobId)
          : null,
        posterUrl: result.hasPoster ? API_ROUTES.exportPoster(projectId, result.jobId) : null,
      })),
      // Alles in één zip; `null` zolang er niets klaarstaat.
      archiveUrl: overview.downloadableCount > 0 ? API_ROUTES.exportArchive(projectId) : null,
    });
  });
}
