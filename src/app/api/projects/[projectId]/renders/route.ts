import { handle, jsonOk, readJsonObject, requireApiSession } from "@/lib/api";
import { getRenderJobStore } from "@/db/render-job-store";
import { readPresetIds } from "@/lib/projects/input";
import { startRenders } from "@/lib/projects/renders";
import { loadOwnProject } from "@/lib/projects/service";
import { toRenderJobSnapshot } from "@/lib/render/status";

/**
 * De renders van een project: starten en opvragen.
 *
 * `GET` is de eenvoudige helft van een paar. Een tabblad dat elke paar seconden
 * hierheen vraagt, is met niets kapot te krijgen: geen open verbinding, geen
 * herverbindingslogica, en het werkt achter elke proxy. `stream/` doet
 * hetzelfde met een open verbinding, voor wie de balk wil zien lopen.
 *
 * `POST` zet er een in de wachtrij, één per gekozen platform. Het antwoord is
 * een **202**: er is niets gerenderd, er is werk aangenomen. Twee keer
 * versturen levert geen twee renders op — de id van een job volgt uit project,
 * preset en renderplan — dus een client die niet weet of zijn verzoek aankwam,
 * mag het gerust nog eens proberen.
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

    // Een voortgangsbalk die uit de cache komt, staat stil; `jsonOk` zet
    // daarom overal `no-store`.
    return jsonOk({
      projectId,
      status: project.status,
      jobs: jobs.map(toRenderJobSnapshot),
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const session = await requireApiSession("project:edit");
    const { projectId } = await params;
    const presetIds = readPresetIds(await readJsonObject(request));

    const { requests, jobs } = await startRenders({
      organisationId: session.organisation.id,
      requestedBy: session.user.id,
      projectId,
      presetIds,
    });

    return jsonOk(
      {
        projectId,
        status: "wachtrij",
        // `requests` is wat je op een scherm zet — label, formaat, bestandsnaam
        // — en `jobs` is wat je volgt. Dezelfde renders, twee keer bekeken.
        requests,
        jobs,
      },
      { status: 202 },
    );
  });
}
