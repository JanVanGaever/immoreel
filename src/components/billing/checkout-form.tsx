"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { PaymentMethodPicker } from "@/components/billing/payment-method-picker";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initialBillingState, type BillingActionState } from "@/lib/billing/action-state";
import { startCheckoutAction } from "@/lib/billing/actions";
import { DEFAULT_PAYMENT_METHOD, findPaymentMethod } from "@/lib/billing/methods";
import { priceBreakdown } from "@/lib/billing/plans";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PaymentMethodId, Plan, Subscription } from "@/types";

/**
 * De laatste stap voor Mollie: wat je koopt, wat het kost, en waarmee je
 * betaalt.
 *
 * Alles wat een Belgische ondernemer wil weten voor hij op een betaalknop
 * duwt, staat op dit ene scherm: het bedrag zonder btw, de btw apart, het
 * totaal dat van de rekening gaat, de datum van de volgende afschrijving, en
 * dat het bij Mollie gebeurt en niet bij ons. Geen enkel van die dingen hoort
 * pas op het betaalscherm zelf te blijken.
 */

export type CheckoutFormProps = {
  plan: Plan;
  subscription: Subscription;
  /** Testsleutel bij Mollie: dan gaat er geen euro echt over. */
  isTestMode: boolean;
  /** Zonder API-sleutel valt er niets af te rekenen. */
  isConfigured: boolean;
};

export function CheckoutForm({ plan, subscription, isTestMode, isConfigured }: CheckoutFormProps) {
  const [method, setMethod] = useState<PaymentMethodId>(
    subscription.paymentMethod ?? DEFAULT_PAYMENT_METHOD,
  );
  const [state, setState] = useState<BillingActionState>(initialBillingState);
  const [isPending, startTransition] = useTransition();

  const breakdown = priceBreakdown(plan.pricePerMonthInCents);
  const selected = findPaymentMethod(method);
  const isRetry = subscription.status === "achterstallig";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(initialBillingState);

    startTransition(async () => {
      // Bij succes eindigt de actie met een redirect naar Mollie en komt er
      // niets terug; wat hier belandt is dus altijd een fout.
      const result = await startCheckoutAction(plan.id, method);

      setState(result);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {!isConfigured ? (
          <Alert variant="warning" title="Betalingen staan nog niet aan">
            Er is geen Mollie-sleutel ingesteld op deze omgeving. Zet <code>MOLLIE_API_KEY</code> in
            je <code>.env</code> en herstart de server.
          </Alert>
        ) : null}

        {isTestMode && isConfigured ? (
          <Alert variant="info" title="Testmodus">
            Dit is een testsleutel van Mollie. Je doorloopt het echte betaalscherm, maar er wordt
            niets afgeschreven.
          </Alert>
        ) : null}

        {state.status === "fout" ? <Alert variant="danger" title={state.message} /> : null}

        <Card>
          <CardHeader>
            <CardTitle>{isRetry ? "Betaling hernieuwen" : "Betaalmethode"}</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentMethodPicker
              value={method}
              onChange={setMethod}
              disabled={isPending || !isConfigured}
            />
          </CardContent>
        </Card>

        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-subtle px-4 py-3 text-xs text-fg-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          <p>
            Je betaalt via <strong className="font-medium text-fg">Mollie</strong>, een erkende
            Belgisch-Nederlandse betaalinstelling. {APP_NAME} ziet je kaartnummer of
            rekeningnummer nooit.
          </p>
        </div>
      </div>

      <Card className="lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle>Overzicht</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <Row label={`${plan.name} — eerste maand`} value={formatCurrency(breakdown.subtotalInCents)} />
          <Row
            label={`Btw ${Math.round(breakdown.vatRate * 100)} %`}
            value={formatCurrency(breakdown.vatInCents)}
          />

          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
            <span className="text-sm font-medium text-fg">Nu te betalen</span>
            <span className="text-lg font-semibold tabular-nums text-fg">
              {formatCurrency(breakdown.totalInCents)}
            </span>
          </div>

          <p className="text-xs leading-snug text-fg-subtle">
            Daarna elke maand {formatCurrency(breakdown.totalInCents)} via {selected.label}
            {subscription.status === "proef"
              ? `. Je proefperiode tot ${formatDate(subscription.currentPeriodEnd)} wordt niet aangerekend.`
              : "."}{" "}
            Maandelijks opzegbaar.
          </p>

          <Button
            type="submit"
            icon={<Lock />}
            isLoading={isPending}
            loadingLabel="Je wordt doorgestuurd"
            disabled={!isConfigured}
            className="w-full"
          >
            Betalen met {selected.label}
          </Button>

          <Link
            href={ROUTES.billing}
            className={buttonClasses("ghost", "sm", "w-full justify-center")}
          >
            Terug naar facturatie
          </Link>
        </CardContent>
      </Card>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="min-w-0 text-sm text-fg-muted">{label}</span>
      <span className="shrink-0 text-sm tabular-nums text-fg">{value}</span>
    </div>
  );
}
