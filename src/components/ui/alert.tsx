import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const alertVariants = {
  info: "border-info/25 bg-info-soft text-info",
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-danger/25 bg-danger-soft text-danger",
} as const;

export type AlertVariant = keyof typeof alertVariants;

const alertIcons: Record<AlertVariant, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

export type AlertProps = {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  /** Zet op false in een blok dat al een eigen icoon heeft. */
  showIcon?: boolean;
  className?: string;
};

/**
 * Melding boven een formulier of pagina. Fouten krijgen `role="alert"` zodat
 * een schermlezer ze meteen voorleest; de rest `role="status"`, dat rustiger
 * onderbreekt.
 */
export function Alert({
  variant = "info",
  title,
  children,
  showIcon = true,
  className,
}: AlertProps) {
  const Icon = alertIcons[variant];

  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        alertVariants[variant],
        className,
      )}
    >
      {showIcon ? <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
      <div className="min-w-0 leading-snug">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "text-fg-muted")}>{children}</div> : null}
      </div>
    </div>
  );
}
