import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = {
  neutral: "border-border bg-surface-subtle text-fg-muted",
  brand: "border-transparent bg-brand-soft text-brand",
  accent: "border-transparent bg-accent-soft text-accent",
  success: "border-transparent bg-success-soft text-success",
  warning: "border-transparent bg-warning-soft text-warning",
  danger: "border-transparent bg-danger-soft text-danger",
  info: "border-transparent bg-info-soft text-info",
} as const;

export const badgeSizes = {
  sm: "px-2 py-0.5 text-[0.6875rem]",
  md: "px-2.5 py-0.5 text-xs",
} as const;

export type BadgeVariant = keyof typeof badgeVariants;
export type BadgeSize = keyof typeof badgeSizes;

export type BadgeProps = ComponentProps<"span"> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Statusbolletje vóór de tekst, bijvoorbeeld voor renderstatussen. */
  dot?: boolean;
};

export function Badge({ variant = "neutral", size = "md", dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        badgeVariants[variant],
        badgeSizes[size],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
