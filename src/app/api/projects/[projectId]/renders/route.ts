import { NextResponse } from "next/server";
import { getProjectStore } from "@/db/project-store";
import { getRenderJobStore } from "@/db/render-job-store";
import { can } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { toRenderJobSnapshot } from "@/lib/render/status";

/**
 * Pollen: de stand van alle renders van dit project.
 *
 * De eenvoudige helft van het paar. Een tabblad dat elke paar seconden hierheen
 * vraagt, is met niets kapot te krijgen: geen open verbinding, geen
 * herverbindingslogica, en het werkt achter elke proxy. `stream/` doet
 * hetzelfde met een open verbinding, voor wie de balk wil zien lopen.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  if (!can(session.role, "project:view")) {
    return NextResponse.json({ error: "Onvoldoende rechten." }, { status: 403 });
  }

  const { projectId } = await params;
  const organisationId = session.organisation.id;

  // Het project opzoeken is meteen de controle of het van deze organisatie is.
  const project = await getProjectStore().findProject(organisationId, projectId);
  if (!project) return NextResponse.json({ error: "Onbekend project." }, { status: 404 });

  const jobs = await getRenderJobStore().listForProject(organisationId, projectId);

  return NextResponse.json(
    { projectId, status: project.status, jobs: jobs.map(toRenderJobSnapshot) },
    // Een voortgangsbalk die uit de cache komt, staat stil.
    { headers: { "Cache-Control": "no-store" } },
  );
}
