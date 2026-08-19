import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * De opbouw van een paneel in de editor: een vaste kop en een deel dat
 * scrollt. Elk paneel gebruikt dit, zodat een nieuw paneel toevoegen niets
 * meer is dan de inhoud schrijven — en zodat links, midden en rechts altijd
 * dezelfde koptekst en marges hebben.
 */

export type EditorPanelProps = {
  title: string;
  /** Rechts in de kop: een teller, een knop, een keuzemenu. */
  actions?: ReactNode;
  /** Blijft onder de kop staan terwijl de inhoud scrollt. */
  sticky?: ReactNode;
  /** Blijft onderaan staan, bijvoorbeeld de balk voor bulkbewerkingen. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function EditorPanel({
  title,
  actions,
  sticky,
  footer,
  children,
  className,
}: EditorPanelProps) {
  return (
    <section className={cn("flex min-h-0 flex-col bg-surface-subtle", className)}>
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <h2 className="text-[0.6875rem] font-semibold tracking-wider text-fg-subtle uppercase">
          {title}
        </h2>
        {actions ? <div className="ml-auto flex items-center gap-1">{actions}</div> : null}
      </header>

      {sticky ? <div className="shrink-0 border-b border-border p-3">{sticky}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

      {footer ? <div className="shrink-0 border-t border-border">{footer}</div> : null}
    </section>
  );
}

export type PanelSectionProps = {
  title: string;
  description?: ReactNode;
  /** Rechts naast de titel, bijvoorbeeld een waarde of een kleine knop. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Eén blok instellingen binnen een paneel. */
export function PanelSection({
  title,
  description,
  aside,
  children,
  className,
}: PanelSectionProps) {
  return (
    <section className={cn("border-b border-border p-3 last:border-b-0", className)}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        {aside}
      </div>
      {description ? (
        <p className="-mt-1.5 mb-2.5 text-xs leading-relaxed text-fg-muted">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

/** Label en waarde naast elkaar, voor de samenvattingen in de panelen. */
export function PanelStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-fg-muted">{label}</span>
      <span className="font-medium text-fg tabular-nums">{value}</span>
    </div>
  );
}
