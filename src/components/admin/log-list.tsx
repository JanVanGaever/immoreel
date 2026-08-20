import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ADMIN_LOG_LEVEL_LABELS,
  ADMIN_LOG_LEVEL_VARIANTS,
  ADMIN_LOG_SOURCE_LABELS,
} from "@/lib/admin/events";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminLogEntry } from "@/types";

export type LogListProps = {
  entries: AdminLogEntry[];
  /** Op een kantoor- of jobpagina staat de organisatie al bovenaan. */
  showOrganisation?: boolean;
  empty?: string;
};

/**
 * De logregels zoals support ze leest.
 *
 * Eén regel per gebeurtenis, met het tijdstip links en de technische velden
 * eronder. Die velden zijn het punt van het hele scherm: `jobId`, `code` en
 * `molliePaymentId` zijn wat er in de zoekbalk van een logdienst of in een
 * mail naar Mollie geplakt wordt, dus ze staan er voluit en selecteerbaar bij.
 */
export function LogList({ entries, showOrganisation = true, empty }: LogListProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center text-sm text-fg-muted">
        {empty ?? "Nog niets gebeurd."}
      </p>
    );
  }

  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:gap-4">
          <div className="shrink-0 sm:w-44">
            <p className="text-xs text-fg-muted tabular-nums">{formatDateTime(entry.at)}</p>
            <p className="text-xs text-fg-subtle">{formatRelativeTime(entry.at)}</p>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={ADMIN_LOG_LEVEL_VARIANTS[entry.level]} size="sm" dot>
                {ADMIN_LOG_LEVEL_LABELS[entry.level]}
              </Badge>
              <Badge variant="neutral" size="sm">
                {ADMIN_LOG_SOURCE_LABELS[entry.source]}
              </Badge>
              {showOrganisation && entry.organisation ? (
                <Link
                  href={ADMIN_ROUTES.organisation(entry.organisation.id)}
                  className="truncate text-xs text-fg-muted underline-offset-2 hover:underline"
                >
                  {entry.organisation.name}
                </Link>
              ) : null}
            </div>

            <p
              className={cn(
                "mt-1.5 text-sm",
                entry.level === "error" ? "font-medium text-fg" : "text-fg",
              )}
            >
              {entry.href ? (
                <Link href={entry.href} className="underline-offset-2 hover:underline">
                  {entry.message}
                </Link>
              ) : (
                entry.message
              )}
            </p>

            {entry.fields.length > 0 ? (
              <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-fg-subtle">
                {entry.fields.map((field) => (
                  <div key={field.label} className="flex min-w-0 gap-1">
                    <dt>{field.label}:</dt>
                    <dd className="break-all text-fg-muted select-all">{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
