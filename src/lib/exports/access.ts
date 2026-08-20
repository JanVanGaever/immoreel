import { getProjectStore } from "@/db/project-store";
import { getRenderJobStore } from "@/db/render-job-store";
import { can } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { buildExportFileName, findExportPreset } from "@/lib/editor/export-presets";
import { buildExportResults, type ExportResult } from "@/lib/exports/results";
import { toRenderJobSnapshot } from "@/lib/render/status";
import type { ID, RenderJob, VideoProject } from "@/types";

/**
 * De poortwachter van de downloadroutes.
 *
 * Alle drie de routes — één bestand, één posterbeeld, alles in een zip —
 * beginnen met exact dezelfde vier vragen: ben je ingelogd, mag je dit zien, is
 * dit project van jou, en welke renders horen erbij. Eén keer beantwoorden
 * scheelt niet alleen herhaling; het scheelt vooral de kans dat er ooit een
 * vierde route bijkomt waar één van de vier vergeten wordt.
 *
 * De bestandsnamen komen uit dezelfde `buildExportResults` als de pagina zelf.
 * Wat er op de knop staat en wat er in de downloadmap terechtkomt, kan dus niet
 * uit elkaar lopen.
 */

export type ProjectExports = {
  project: VideoProject;
  /** De ruwe jobs; alleen hier staat waar het bestand in de opslag ligt. */
  jobs: RenderJob[];
  /** Dezelfde kaarten als op de pagina, in dezelfde volgorde. */
  results: ExportResult[];
};

export type ProjectExportsAccess =
  | { ok: true; exports: ProjectExports }
  | { ok: false; response: Response };

export async function loadProjectExports(projectId: ID): Promise<ProjectExportsAccess> {
  const session = await getSession();
  if (!session) return deny(401, "Niet ingelogd.");
  if (!can(session.role, "project:view")) return deny(403, "Onvoldoende rechten.");

  const organisationId = session.organisation.id;

  // Het project opzoeken is meteen de controle of het van deze organisatie is.
  const project = await getProjectStore().findProject(organisationId, projectId);
  if (!project) return deny(404, "Onbekend project.");

  const jobs = await getRenderJobStore().listForProject(organisationId, projectId);
  const results = buildExportResults(jobs.map(toRenderJobSnapshot), project);

  return { ok: true, exports: { project, jobs, results } };
}

/**
 * De job achter een id, met de naam die het bestand moet krijgen.
 *
 * Meestal is dat de naam van de kaart op de pagina. Een oudere poging voor
 * hetzelfde platform heeft geen kaart meer — daar staat intussen de nieuwste —
 * maar blijft downloadbaar voor wie de link nog heeft; die krijgt de naam die
 * bij zijn formaat hoort, berekend op dezelfde manier.
 */
export function findExport(
  exports: ProjectExports,
  jobId: ID,
): { job: RenderJob; fileName: string } | null {
  const job = exports.jobs.find((candidate) => candidate.id === jobId);
  if (!job) return null;

  const result = exports.results.find((candidate) => candidate.jobId === jobId);
  if (result) return { job, fileName: result.fileName };

  const preset = findExportPreset(job.presetId);

  return {
    job,
    fileName: preset
      ? buildExportFileName(preset, { title: exports.project.title })
      : `render-${job.id}.mp4`,
  };
}

function deny(status: number, message: string): ProjectExportsAccess {
  return { ok: false, response: new Response(message, { status }) };
}
