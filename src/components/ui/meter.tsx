import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const meterTones = {
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-fg-subtle",
} as const;

export type MeterTone = keyof typeof meterTones;

export type MeterProps = {
  value: number;
  max: number;
  /** Zichtbaar label links boven de balk. */
  label?: ReactNode;
  /** Waarde rechts boven de balk, bijvoorbeeld "34 / 40". */
  valueLabel?: ReactNode;
  tone?: MeterTone;
  size?: "sm" | "md";
  /** Nodig als er geen zichtbaar label is. */
  srLabel?: string;
  className?: string;
};

/**
 * Balkje voor verbruik en voortgang. Toont een percentage van `max`; bij een
 * `max` van 0 (onbeperkt) blijft de balk leeg in plaats van vol te lopen.
 */
export function Meter({
  value,
  max,
  label,
  valueLabel,
  tone = "brand",
  size = "md",
  srLabel,
  className,
}: MeterProps) {
  const safeMax = Math.max(max, 0);
  const clamped = Math.min(Math.max(value, 0), safeMax || value);
  const percentage = safeMax > 0 ? Math.min((clamped / safeMax) * 100, 100) : 0;

  return (
    <div className={cn("min-w-0", className)}>
      {label || valueLabel ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label ? <span className="truncate text-sm text-fg-muted">{label}</span> : null}
          {valueLabel ? (
            <span className="shrink-0 text-sm font-medium tabular-nums text-fg">{valueLabel}</span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={safeMax || undefined}
        aria-label={srLabel}
        className={cn(
          "w-full overflow-hidden rounded-full bg-surface-inset",
          size === "sm" ? "h-1" : "h-1.5",
        )}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", meterTones[tone])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
