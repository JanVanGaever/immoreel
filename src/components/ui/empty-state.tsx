import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border",
        // Op een telefoon is veertien rem lucht rond drie regels tekst geen
        // rust maar leegte: de helft van het scherm gaat eraan op.
        "bg-surface/60 px-5 py-10 text-center sm:px-6 sm:py-14",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-surface-subtle text-fg-subtle">
          <Icon className="size-5" />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-fg text-balance">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-fg-muted text-pretty">{description}</p>
      ) : null}
      {/* De knop is hier de hele reden dat de lege staat er staat; op een smal
          scherm mag hij de volle breedte hebben in plaats van een knoopje in
          het midden te zijn. */}
      {action ? (
        <div className="mt-5 w-full max-w-xs [&>*]:w-full sm:w-auto sm:[&>*]:w-auto">{action}</div>
      ) : null}
    </div>
  );
}
