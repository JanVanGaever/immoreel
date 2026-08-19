import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatProps = {
  label: string;
  /** Toon "—" zolang er nog geen data is. */
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
};

export function Stat({ label, value, hint, icon: Icon, className }: StatProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-5 shadow-soft", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">{label}</p>
        {Icon ? <Icon className="size-4 text-fg-subtle" /> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
