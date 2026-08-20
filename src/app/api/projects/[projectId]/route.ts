import { handle, jsonOk, readJsonObject, requireApiSession } from "@/lib/api";
import { readProjectChanges } from "@/lib/projects/input";
import { loadOwnProject, saveProjectChanges } from "@/lib/projects/service";

/**
 * Eén project: lezen en wijzigen.
 *
 * `PATCH` en geen `PUT`, omdat een client zelden het hele project in handen
 * heeft. Wat je meestuurt verandert, de rest blijft; de tijdlijn is daarop de
 * uitzondering, want `scenes` is altijd de volledige rij (zie
 * `src/lib/projects/input.ts`).
 *
 * Wat je *niet* kan zetten: de status en de duur. De status hoort bij de
 * renderwachtrij en wordt door de worker geschreven, de duur volgt uit de
 * tijdlijn en wordt hier opnieuw uitgerekend. Allebei zijn ze afgeleid, en
 * afgeleide waarden die een client mag overschrijven, zijn afgeleide waarden
 * die gaan liegen.
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

    return jsonOk({ project: await loadOwnProject(session.organisation.id, projectId) });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const session = await requireApiSession("project:edit");
    const { projectId } = await params;
    const changes = readProjectChanges(await readJsonObject(request));

    return jsonOk({ project: await saveProjectChanges(session.organisation.id, projectId, changes) });
  });
}
