import { CircleCheck, Clock, Loader, TriangleAlert, Upload, type LucideIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { RENDER_JOB_STATUS_LABELS } from "@/lib/render/status";
import { cn } from "@/lib/utils";
import type { RenderJobStatus } from "@/types";

/**
 * Hoe een renderstatus eruitziet. Naast `PROJECT_STATUS_VARIANTS` in
 * `src/lib/project-status.ts`, maar dan voor één render in plaats van voor een
 * heel project: die twee lopen niet gelijk, want een project met vijf exports
 * is pas "klaar" als de laatste dat is.
 *
 * De woorden zelf komen uit `RENDER_JOB_STATUS_LABELS`, zodat de badge en de
 * logs hetzelfde woord gebruiken.
 */

export const RENDER_STATUS_VARIANTS: Record<RenderJobStatus, BadgeVariant> = {
  queued: "warning",
  processing: "brand",
  finalizing: "info",
  done: "success",
  failed: "danger",
};

export const RENDER_STATUS_ICONS: Record<RenderJobStatus, LucideIcon> = {
  queued: Clock,
  processing: Loader,
  finalizing: Upload,
  done: CircleCheck,
  failed: TriangleAlert,
};

export function ExportStatusBadge({ status }: { status: RenderJobStatus }) {
  const Icon = RENDER_STATUS_ICONS[status];
  const isBusy = status === "processing";

  return (
    <Badge variant={RENDER_STATUS_VARIANTS[status]} className="shrink-0">
      <Icon
        aria-hidden="true"
        // Alleen het renderen draait mee; een job in de wachtrij die staat te
        // tollen, suggereert werk dat er niet is.
        className={cn("size-3", isBusy && "motion-safe:animate-spin")}
      />
      {RENDER_JOB_STATUS_LABELS[status]}
    </Badge>
  );
}
