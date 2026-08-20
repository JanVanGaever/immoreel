import { priceBreakdown } from "@/lib/billing/plans";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Een prijs, twee keer.
 *
 * Een makelaarskantoor is een onderneming: het rekent de btw terug, dus het
 * bedrag dat telt is dat zonder. Maar het bedrag dat van de rekening gaat, is
 * dat mét — en niets wekt zoveel wantrouwen als een afschrift dat niet
 * overeenkomt met wat er op het scherm stond. Dus staan ze er allebei, altijd,
 * en met zoveel woorden welk welk is.
 */

export type PriceProps = {
  /** Exclusief btw. */
  subtotalInCents: number;
  /** Achter het bedrag, bijvoorbeeld "/ maand". */
  suffix?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { main: "text-base", note: "text-[0.6875rem]" },
  md: { main: "text-xl", note: "text-xs" },
  lg: { main: "text-3xl", note: "text-xs" },
} as const;

export function Price({ subtotalInCents, suffix, size = "md", className }: PriceProps) {
  const breakdown = priceBreakdown(subtotalInCents);
  const scale = sizes[size];

  return (
    <p className={cn("min-w-0", className)}>
      <span className={cn("font-semibold tracking-tight tabular-nums text-fg", scale.main)}>
        {formatCurrency(breakdown.subtotalInCents)}
      </span>
      {suffix ? (
        <span className="ml-1 text-sm font-normal text-fg-muted">{suffix}</span>
      ) : null}
      <span className={cn("mt-0.5 block text-fg-subtle tabular-nums", scale.note)}>
        {formatCurrency(breakdown.totalInCents)} incl. {Math.round(breakdown.vatRate * 100)} % btw
      </span>
    </p>
  );
}
