import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DataTable, DetailList, JobTable, LogList, RawRecord } from "@/components/admin";
import type { DataTableColumn } from "@/components/admin";
import { ProjectStatusBadge } from "@/components/dashboard/project-status-badge";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStore } from "@/db/admin-store";
import { ADMIN_PARAMS } from "@/lib/admin/query";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { formatDateTime, formatNumber, formatSeconds } from "@/lib/format";
import type { AdminSceneRow } from "@/types";

export const metadata: Metadata = { title: "Project" };
export const dynamic = "force-dynamic";

/**
 * Eén project, zoals het opgeslagen staat.
 *
 * De scènelijst staat erbij omdat de meeste renderfouten daar hun oorzaak
 * hebben: een scène zonder foto, een scène van een halve seconde, een tijdlijn
 * die niet is wat de klant denkt te hebben gemaakt. De foto's zelf staan er
 * niet — dit paneel toont geen klantenmedia, alleen de verwijzing ernaar.
 */
export default async function AdminProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const detail = await getAdminStore().findProject(projectId);
  if (!detail) notFound();

  const { project } = detail;

  const sceneColumns: DataTableColumn<AdminSceneRow>[] = [
    { key: "order", header: "#", cell: (row) => row.order + 1 },
    {
      key: "asset",
      header: "Media",
      cell: (row) =>
        row.assetId ? (
          <code className="font-mono text-xs text-fg-muted select-all">{row.assetId}</code>
        ) : (
          <span className="text-danger">Geen media</span>
        ),
    },
    {
      key: "duration",
      header: "Lengte",
      align: "right",
      cell: (row) => formatSeconds(row.durationInSeconds),
    },
    { key: "motion", header: "Beweging", cell: (row) => row.motion },
    {
      key: "transition",
      header: "Overgang",
      cell: (row) => row.transition ?? <span className="text-fg-subtle">—</span>,
    },
    {
      key: "caption",
      header: "Tekst",
      cell: (row) => row.caption ?? <span className="text-fg-subtle">—</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={project.title}
        description={
          project.organisation
            ? `Project van ${project.organisation.name}`
            : "Project zonder kantoor"
        }
        actions={
          <Link href={ADMIN_ROUTES.projects} className={buttonClasses("secondary", "md")}>
            <ArrowLeft />
            Projecten
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProjectStatusBadge status={project.status} size="md" />
        {project.organisation ? (
          <Link
            href={ADMIN_ROUTES.organisation(project.organisation.id)}
            className="text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            Naar het kantoor
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList
            columns={4}
            items={[
              { label: "Project-id", value: project.id, mono: true },
              { label: "Beeldverhouding", value: project.aspectRatio },
              { label: "Template", value: project.templateId, mono: Boolean(project.templateId) },
              { label: "Scènes", value: formatNumber(project.sceneCount) },
              { label: "Lengte", value: formatSeconds(project.durationInSeconds) },
              { label: "Exportformaten", value: formatNumber(project.exportPresetCount) },
              { label: "Aangemaakt", value: formatDateTime(project.createdAt) },
              { label: "Bijgewerkt", value: formatDateTime(project.updatedAt) },
            ]}
          />
        </CardContent>
      </Card>

      <section className="mt-8">
        <SectionHeader
          title="Renders"
          description={`${formatNumber(project.jobCounts.total)} in totaal, waarvan ${formatNumber(project.jobCounts.failed)} mislukt.`}
          actions={
            project.organisation ? (
              <Link
                href={`${ADMIN_ROUTES.jobs}?${ADMIN_PARAMS.organisation}=${project.organisation.id}`}
                className="text-sm text-fg-muted underline-offset-2 hover:underline"
              >
                Alle renders van dit kantoor
              </Link>
            ) : null
          }
        />
        <JobTable
          rows={detail.jobs}
          showProject={false}
          showOrganisation={false}
          empty="Dit project is nog nooit geëxporteerd."
        />
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Tijdlijn van de montage"
          description="De scènes zoals ze opgeslagen staan. De foto's zelf staan hier niet."
        />
        <DataTable
          rows={detail.scenes}
          columns={sceneColumns}
          getKey={(row) => row.id}
          empty="Dit project heeft nog geen scènes."
        />
      </section>

      <section className="mt-8">
        <SectionHeader title="Wat er gebeurde" />
        <LogList entries={detail.timeline} showOrganisation={false} />
      </section>

      <div className="mt-4">
        <RawRecord value={detail.raw} title="Ruw project" />
      </div>
    </>
  );
}
