import Link from "next/link";
import { CellStack, DataTable, Identifier, type DataTableColumn } from "@/components/admin/data-table";
import { ExportStatusBadge } from "@/components/exports/export-status-badge";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { formatDateTime, formatDuration, formatRelativeTime } from "@/lib/format";
import { RENDER_STAGE_LABELS } from "@/lib/render/status";
import type { AdminJobRow } from "@/types";

export type JobTableProps = {
  rows: AdminJobRow[];
  /** Op een kantoorpagina staat de organisatie al bovenaan; dan valt die kolom weg. */
  showOrganisation?: boolean;
  /** Idem voor de projectkolom op een projectpagina. */
  showProject?: boolean;
  empty?: string;
};

/**
 * De renderjobs, overal in dezelfde vorm.
 *
 * Deze tabel staat op drie plekken — de renderlijst, de kantoorpagina en de
 * projectpagina — en dat is precies waarom ze één component is: een fout die
 * support leert lezen op het ene scherm, leest hij op het andere op dezelfde
 * plek terug.
 *
 * De foutkolom toont de code én de zin. De code is waarop gefilterd en gezocht
 * wordt, de zin is wat de klant te zien kreeg; support heeft ze allebei nodig
 * om te weten waar het gesprek over gaat.
 */
export function JobTable({
  rows,
  showOrganisation = true,
  showProject = true,
  empty = "Geen renders gevonden.",
}: JobTableProps) {
  const columns: DataTableColumn<AdminJobRow>[] = [
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <div className="space-y-1">
          <ExportStatusBadge status={row.status} />
          {row.stage && row.status !== "done" && row.status !== "failed" ? (
            <p className="text-xs text-fg-subtle">
              {RENDER_STAGE_LABELS[row.stage]} · {row.progress}%
            </p>
          ) : null}
        </div>
      ),
    },
    ...(showProject
      ? [
          {
            key: "project",
            header: "Project",
            cell: (row: AdminJobRow) =>
              row.project ? (
                <Link
                  href={ADMIN_ROUTES.project(row.project.id)}
                  className="block hover:underline"
                >
                  <CellStack title={row.project.title} subtitle={row.presetLabel} />
                </Link>
              ) : (
                <CellStack title="Project bestaat niet meer" subtitle={row.presetLabel} />
              ),
          },
        ]
      : [
          {
            key: "preset",
            header: "Export",
            cell: (row: AdminJobRow) => <span className="text-sm">{row.presetLabel}</span>,
          },
        ]),
    ...(showOrganisation
      ? [
          {
            key: "organisation",
            header: "Kantoor",
            cell: (row: AdminJobRow) =>
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
      key: "error",
      header: "Fout",
      cell: (row) =>
        row.error ? (
          <div className="max-w-80">
            <code className="font-mono text-xs text-danger">{row.error.code}</code>
            <p className="mt-0.5 text-xs text-fg-muted">{row.error.message}</p>
            {!row.error.retryable ? (
              <p className="mt-0.5 text-xs text-fg-subtle">Opnieuw proberen heeft geen zin.</p>
            ) : null}
          </div>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: "attempt",
      header: "Poging",
      align: "right",
      cell: (row) => (row.attempt > 0 ? row.attempt : "—"),
    },
    {
      key: "duration",
      header: "Duur",
      align: "right",
      cell: (row) => {
        if (!row.startedAt || !row.finishedAt) return <span className="text-fg-subtle">—</span>;

        const seconds =
          (new Date(row.finishedAt).getTime() - new Date(row.startedAt).getTime()) / 1000;

        return <span className="text-sm text-fg-muted">{formatDuration(seconds)}</span>;
      },
    },
    {
      key: "queued",
      header: "In wachtrij",
      align: "right",
      cell: (row) => (
        <span className="text-sm text-fg-muted" title={formatDateTime(row.queuedAt)}>
          {formatRelativeTime(row.queuedAt)}
        </span>
      ),
    },
    {
      key: "id",
      header: "Job",
      cell: (row) => (
        <Link href={ADMIN_ROUTES.job(row.id)} className="hover:underline">
          <Identifier value={row.id} />
        </Link>
      ),
    },
  ];

  return <DataTable rows={rows} columns={columns} getKey={(row) => row.id} empty={empty} />;
}
