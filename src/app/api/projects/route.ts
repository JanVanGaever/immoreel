import { handle, jsonCreated, jsonOk, readJsonObject, requireApiSession } from "@/lib/api";
import { API_ROUTES } from "@/lib/constants";
import { readNewProjectInput } from "@/lib/projects/input";
import { createOwnProject, listOwnProjects } from "@/lib/projects/service";

/**
 * De projecten van dit kantoor: opsommen en aanmaken.
 *
 * De wizard in de app gebruikt een serveractie en niet deze route — die kan
 * meteen doorsturen naar de editor, en dat is voor een formulier het juiste
 * gedrag. Deze route is voor alles daarbuiten: een koppeling met het
 * kantoorpakket dat elke nieuwe zoekertje een video geeft, een script dat
 * twintig panden ineens klaarzet, een tweede client. Beide wegen komen uit bij
 * dezelfde functies in `src/lib/projects/service.ts`, dus ze kunnen niet uit
 * elkaar lopen.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireApiSession("project:view");
    const projects = await listOwnProjects(session.organisation.id);

    return jsonOk({ projects });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireApiSession("project:create");
    const input = readNewProjectInput(await readJsonObject(request));
    const project = await createOwnProject(session.organisation.id, input);

    return jsonCreated({ project }, API_ROUTES.project(project.id));
  });
}
