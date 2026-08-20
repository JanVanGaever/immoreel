import { Badge, type BadgeSize, type BadgeVariant } from "@/components/ui/badge";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import type { Role } from "@/types";

/**
 * Eén kleur per rol, overal dezelfde. De eigenaar krijgt de merkkleur omdat
 * dat de rol is die je in één blik wil terugvinden; een kijker blijft grijs,
 * want die verandert niets.
 */
export const ROLE_BADGE_VARIANTS: Record<Role, BadgeVariant> = {
  owner: "brand",
  editor: "info",
  viewer: "neutral",
};

export type RoleBadgeProps = {
  role: Role;
  size?: BadgeSize;
  className?: string;
};

export function RoleBadge({ role, size = "sm", className }: RoleBadgeProps) {
  return (
    <Badge
      variant={ROLE_BADGE_VARIANTS[role]}
      size={size}
      className={className}
      title={ROLE_DESCRIPTIONS[role]}
    >
      {ROLE_LABELS[role]}
    </Badge>
  );
}
