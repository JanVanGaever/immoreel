"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Eén veld dat van de huisstijl mag afwijken.
 *
 * Een project erft alles van het kantoor; dit component maakt zichtbaar wanneer
 * dat niet meer zo is. Zolang er niets overruled is, staat er wat de huisstijl
 * zegt en één knop om ervan af te wijken — geen ingevuld veld dat je in het
 * ongewisse laat of het nu van jou of van het kantoor komt.
 *
 * De knop terug heet niet "wissen" maar "volg huisstijl": dat is wat er
 * gebeurt, en het verschil telt. Een leeg veld blijft leeg; een veld dat de
 * huisstijl volgt, verandert mee zodra het kantoor iets aanpast.
 */

export type BrandOverrideProps = {
  label: string;
  /** Wat de huisstijl zegt, in leesvorm. Staat er als je niet afwijkt. */
  inherited: ReactNode;
  isOverridden: boolean;
  /** Zet het veld op zijn eigen waarde; krijgt de huidige huisstijlwaarde mee. */
  onOverride: () => void;
  /** Zet het veld terug op `null`, oftewel: volg de huisstijl. */
  onInherit: () => void;
  disabled?: boolean;
  /** De echte control; alleen zichtbaar zodra er afgeweken wordt. */
  children: ReactNode;
  className?: string;
};

export function BrandOverride({
  label,
  inherited,
  isOverridden,
  onOverride,
  onInherit,
  disabled = false,
  children,
  className,
}: BrandOverrideProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-fg">{label}</span>

        <button
          type="button"
          disabled={disabled}
          onClick={isOverridden ? onInherit : onOverride}
          className={cn(
            "shrink-0 text-[0.6875rem] underline underline-offset-2",
            "text-fg-subtle hover:text-fg disabled:pointer-events-none disabled:opacity-55",
          )}
        >
          {isOverridden ? "Volg huisstijl" : "Afwijken"}
        </button>
      </div>

      {isOverridden ? (
        children
      ) : (
        <p className="truncate rounded-md border border-dashed border-border bg-surface-subtle px-2.5 py-1.5 text-[0.6875rem] text-fg-muted">
          {inherited}
        </p>
      )}
    </div>
  );
}
