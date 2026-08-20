import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, Film, Pencil } from "lucide-react";
import { ExportResults } from "@/components/exports";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getProjectStore } from "@/db/project-store";
import { getRenderJobStore } from "@/db/render-job-store";
import { can } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { toRenderJobSnapshot } from "@/lib/render/status";

export const metadata: Metadata = { title: "Downloads" };

type PageProps = { params: Promise<{ projectId: string }> };

/**
 * Waar een project eindigt: de afgewerkte video's.
 *
 * De pagina laadt de renderjobs op de server, zodat er meteen iets staat — ook
 * zonder JavaScript, ook op een trage verbinding. Wat daarna beweegt, beweegt in
 * de browser (`ExportResults`), die dezelfde jobs blijft volgen via de
 * eventstroom.
 *
 * De downloads zelf lopen niet langs hier maar langs `/api/.../exports/...`.
 * Een pagina die video's doorgeeft, is een pagina die niet meer kan cachen en
 * die bij elke download opnieuw gerenderd wordt.
 */
export default async function ProjectExportsPage({ params }: PageProps) {
  const { projectId } = await params;
  const { organisation, role } = await requireSession();

  const project = await getProjectStore().findProject(organisation.id, projectId);

  if (!project) {
    // Bewust geen 404, net als in de editor: de projectstore draait in het
    // geheugen van het proces, dus na een herstart is een bestaand project weg.
    return (
      <>
        <PageHeader title="Downloads" description="De afgewerkte video's van dit project." />
        <EmptyState
          icon={Film}
          title="Dit project is er niet (meer)"
          description="Projecten worden voorlopig in het geheugen bewaard, dus na een herstart van de server zijn ze weg. Maak er een nieuw aan om verder te werken."
          action={
            <Link href={ROUTES.newProject} className={buttonClasses("primary", "md")}>
              <FilePlus2 />
              Nieuw project
            </Link>
          }
        />
      </>
    );
  }

  const jobs = await getRenderJobStore().listForProject(organisation.id, projectId);

  return (
    <>
      <PageHeader
        title="Downloads"
        description={`${project.title} · ${formatDuration(project.durationInSeconds)} · ${project.aspectRatio}`}
        actions={
          <>
            <Link
              href={ROUTES.project(projectId)}
              className={buttonClasses("secondary", "md")}
            >
              Naar het project
            </Link>
            {can(role, "project:edit") ? (
              <Link href={ROUTES.editor(projectId)} className={buttonClasses("secondary", "md")}>
                <Pencil />
                Openen in editor
              </Link>
            ) : null}
          </>
        }
      />

      <ExportResults
        projectId={project.id}
        project={{ title: project.title, durationInSeconds: project.durationInSeconds }}
        initialSnapshots={jobs.map(toRenderJobSnapshot)}
        mayRetry={can(role, "project:edit")}
      />
    </>
  );
}
