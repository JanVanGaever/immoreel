import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { ADMIN_PARAMS, adminHref, pageCount, type AdminSearchParams } from "@/lib/admin/query";
import { formatNumber } from "@/lib/format";
import type { Paginated } from "@/types";

export type PaginationProps = {
  result: Paginated<unknown>;
  pathname: string;
  params: AdminSearchParams;
  /** Meervoud van wat er in de lijst staat: "renders", "kantoren". */
  label: string;
};

/**
 * Bladeren, met het aantal erbij.
 *
 * Het aantal is het belangrijkste van de twee: "3 van 412" vertelt of je zoekt
 * of dat je alles voor je hebt, en dat bepaalt of een lege plek in de lijst een
 * antwoord is of een reden om anders te zoeken.
 */
export function Pagination({ result, pathname, params, label }: PaginationProps) {
  const total = pageCount(result);
  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted">
      <p>
        {result.total === 0
          ? `Geen ${label}`
          : `${formatNumber(first)}–${formatNumber(last)} van ${formatNumber(result.total)} ${label}`}
      </p>

      {total > 1 ? (
        <div className="flex items-center gap-2">
          {result.page > 1 ? (
            <Link
              href={adminHref(pathname, params, { [ADMIN_PARAMS.page]: String(result.page - 1) })}
              className={buttonClasses("secondary", "sm")}
            >
              <ChevronLeft />
              Vorige
            </Link>
          ) : null}

          <span className="tabular-nums">
            {result.page} / {total}
          </span>

          {result.page < total ? (
            <Link
              href={adminHref(pathname, params, { [ADMIN_PARAMS.page]: String(result.page + 1) })}
              className={buttonClasses("secondary", "sm")}
            >
              Volgende
              <ChevronRight />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
