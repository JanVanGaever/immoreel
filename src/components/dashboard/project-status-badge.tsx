import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_VARIANTS } from "@/lib/project-status";
import type { ProjectStatus } from "@/types";

export type ProjectStatusBadgeProps = Omit<BadgeProps, "variant" | "children"> & {
  status: ProjectStatus;
};

/** De status van een project, overal in dezelfde kleur en met hetzelfde woord. */
export function ProjectStatusBadge({ status, size = "sm", ...props }: ProjectStatusBadgeProps) {
  return (
    <Badge variant={PROJECT_STATUS_VARIANTS[status]} size={size} dot {...props}>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}
