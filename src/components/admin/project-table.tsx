import Link from "next/link";
import {
  CellStack,
  DataTable,
  Identifier,
  type DataTableColumn,
} from "@/components/admin/data-table";
import { ProjectStatusBadge } from "@/components/dashboard/project-status-badge";
import { Badge } from "@/components/ui/badge";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { formatDateTime, formatNumber, formatRelativeTime, formatSeconds } from "@/lib/format";
import type { AdminProjectRow } from "@/types";

export type ProjectTableProps = {
  rows: AdminProjectRow[];
  showOrganisation?: boolean;
  empty?: string;
};

/**
 * De projecten, overal in dezelfde vorm.
 *
 * De kolom "renders" telt per stand en niet in totaal. Een project met vijf
 * exports waarvan er één mislukte, is een heel ander gesprek dan een project
 * waarvan er vijf mislukten, en dat verschil hoort in de lijst te staan en niet
 * pas op de detailpagina.
 */
export function ProjectTable({
  rows,
  showOrganisation = true,
  empty = "Geen projecten gevonden.",
}: ProjectTableProps) {
  const columns: DataTableColumn<AdminProjectRow>[] = [
    {
      key: "project",
      header: "Project",
      cell: (row) => (
        <Link href={ADMIN_ROUTES.project(row.id)} className="block hover:underline">
          <CellStack
            title={row.title}
            subtitle={`${row.aspectRatio} · ${formatNumber(row.sceneCount)} scènes · ${formatSeconds(row.durationInSeconds)}`}
          />
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <ProjectStatusBadge status={row.status} />,
    },
    ...(showOrganisation
      ? [
          {
            key: "organisation",
            header: "Kantoor",
            cell: (row: AdminProjectRow) =>
              row.organisation ? (
                <Link
                  href={ADMIN_ROUTES.organisation(row.organisation.id)}
                  className="text-sm underline-offset-2 hover:underline"
                >
                  {row.organisation.name}
                </Link>
              ) : (
                <span className="text-fg-subtle">—</span>
              ),
          },
        ]
      : []),
    {
      key: "jobs",
      header: "Renders",
      cell: (row) =>
        row.jobCounts.total === 0 ? (
          <span className="text-sm text-fg-subtle">Nog niet geëxporteerd</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.jobCounts.failed > 0 ? (
              <Badge variant="danger" size="sm">
                {formatNumber(row.jobCounts.failed)} mislukt
              </Badge>
            ) : null}
            {row.jobCounts.running > 0 ? (
              <Badge variant="brand" size="sm">
                {formatNumber(row.jobCounts.running)} bezig
              </Badge>
            ) : null}
            {row.jobCounts.queued > 0 ? (
              <Badge variant="warning" size="sm">
                {formatNumber(row.jobCounts.queued)} in wachtrij
              </Badge>
            ) : null}
            {row.jobCounts.done > 0 ? (
              <Badge variant="success" size="sm">
                {formatNumber(row.jobCounts.done)} klaar
              </Badge>
            ) : null}
          </div>
        ),
    },
    {
      key: "updated",
      header: "Bijgewerkt",
      align: "right",
      cell: (row) => (
        <span className="text-sm text-fg-muted" title={formatDateTime(row.updatedAt)}>
          {formatRelativeTime(row.updatedAt)}
        </span>
      ),
    },
    {
      key: "id",
      header: "Id",
      cell: (row) => <Identifier value={row.id} />,
    },
  ];

  return <DataTable rows={rows} columns={columns} getKey={(row) => row.id} empty={empty} />;
}
