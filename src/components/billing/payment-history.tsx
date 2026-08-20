import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_VARIANTS } from "@/lib/billing/invoices";
import { findPaymentMethod } from "@/lib/billing/methods";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/types";

/**
 * De betaalgeschiedenis.
 *
 * Ook de mislukte pogingen staan erin, en dat is de reden dat dit een lijst is
 * en geen factuurmap: wie op deze pagina komt omdat zijn abonnement op
 * "betaling openstaand" staat, vindt hier de regel die het uitlegt, met de
 * reden erbij in gewone woorden.
 *
 * Bedragen staan inclusief btw, want dat is wat er van de rekening ging; het
 * bedrag zonder staat eronder voor de boekhouding.
 */

export type PaymentHistoryProps = {
  invoices: Invoice[];
  className?: string;
};

export function PaymentHistory({ invoices, className }: PaymentHistoryProps) {
  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Nog geen betalingen"
        description="Zodra je een plan kiest, verschijnt hier elke afschrijving met datum en bedrag."
        className={className}
      />
    );
  }

  return (
    <Card className={cn("divide-y divide-border overflow-hidden", className)}>
      {invoices.map((invoice) => {
        const method = invoice.method ? findPaymentMethod(invoice.method) : null;

        return (
          <article key={invoice.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-fg">{invoice.description}</p>
                <Badge variant={INVOICE_STATUS_VARIANTS[invoice.status]} size="sm">
                  {INVOICE_STATUS_LABELS[invoice.status]}
                </Badge>
              </div>

              <p className="mt-1 text-xs text-fg-subtle">
                {invoice.number}
                {" · "}
                {formatDate(invoice.paidAt ?? invoice.createdAt)}
                {method ? ` · ${method.label}` : ""}
                {invoice.periodStart && invoice.periodEnd
                  ? ` · periode ${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
                  : ""}
              </p>

              {invoice.failureReason ? (
                <p className="mt-1.5 text-xs text-danger">{invoice.failureReason}</p>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  invoice.status === "mislukt" ? "text-fg-subtle line-through" : "text-fg",
                )}
              >
                {formatCurrency(invoice.amountInCents)}
              </p>
              <p className="mt-0.5 text-[0.6875rem] text-fg-subtle tabular-nums">
                {formatCurrency(invoice.subtotalInCents)} excl. btw
              </p>
            </div>
          </article>
        );
      })}
    </Card>
  );
}
