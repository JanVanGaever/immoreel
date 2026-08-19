import Link from "next/link";
import { Meter, type MeterTone } from "@/components/ui/meter";
import { ROUTES } from "@/lib/constants";
import {
  PROJECT_STATUS_ICONS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
} from "@/lib/project-status";
import { cn } from "@/lib/utils";
import type { ProjectStatus, ProjectStatusCounts } from "@/types";

export type StatusOverviewProps = {
  counts: ProjectStatusCounts;
  total: number;
  className?: string;
};

/** Kleur van icoon en balkje per status; volgt de badgevarianten. */
const statusTone: Record<ProjectStatus, { icon: string; meter: MeterTone }> = {
  concept: { icon: "text-fg-subtle", meter: "neutral" },
  "in-bewerking": { icon: "text-info", meter: "brand" },
  wachtrij: { icon: "text-warning", meter: "warning" },
  renderen: { icon: "text-brand", meter: "brand" },
  klaar: { icon: "text-success", meter: "success" },
  mislukt: { icon: "text-danger", meter: "danger" },
};

/**
 * Strook met het aantal projecten per status. Elke tegel linkt door naar de
 * projectenlijst met die status als filter.
 */
export function StatusOverview({ counts, total, className }: StatusOverviewProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6", className)}>
      {PROJECT_STATUS_ORDER.map((status) => {
        const Icon = PROJECT_STATUS_ICONS[status];
        const count = counts[status];
        const tone = statusTone[status];

        return (
          <Link
            key={status}
            href={`${ROUTES.projects}?status=${status}`}
            className={cn(
              "rounded-xl border border-border bg-surface p-4 shadow-soft",
              "transition-colors duration-150 hover:border-border-strong hover:bg-surface-subtle",
            )}
          >
            <span className="flex items-center gap-2">
              <Icon aria-hidden="true" className={cn("size-4 shrink-0", tone.icon)} />
              <span className="truncate text-sm text-fg-muted">
                {PROJECT_STATUS_LABELS[status]}
              </span>
            </span>
            <span className="mt-2 block text-xl font-semibold tracking-tight tabular-nums">
              {count}
            </span>
            <Meter
              className="mt-2"
              size="sm"
              value={count}
              max={total}
              tone={tone.meter}
              srLabel={`${count} van ${total} projecten met status ${PROJECT_STATUS_LABELS[status]}`}
            />
          </Link>
        );
      })}
    </div>
  );
}
