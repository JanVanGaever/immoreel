"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, RotateCcw } from "lucide-react";
import { Price } from "@/components/billing/price";
import { Alert } from "@/components/ui/alert";
import { ErrorSummary } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { initialBillingState, type BillingActionState } from "@/lib/billing/action-state";
import { cancelSubscriptionAction, resumeSubscriptionAction } from "@/lib/billing/actions";
import { findPaymentMethod } from "@/lib/billing/methods";
import { getPlan } from "@/lib/billing/plans";
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_VARIANTS,
  periodSentence,
} from "@/lib/billing/status";
import { ROUTES } from "@/lib/constants";
import { daysUntil } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import type { CheckoutAttempt, Subscription } from "@/types";

/**
 * Waar het abonnement nu staat, en wat er nu kan.
 *
 * Elke toestand krijgt één zin en hoogstens twee knoppen. Dat is bewust
 * karig: iemand die op deze pagina komt, komt met één vraag — "wanneer wordt er
 * afgeschreven" of "waarom werkt het niet meer" — en een paneel vol
 * mogelijkheden beantwoordt geen van beide.
 */

export type SubscriptionPanelProps = {
  subscription: Subscription;
  /** Een betaling die nog loopt; alleen bij status `wachtend`. */
  openCheckout: CheckoutAttempt | null;
  canManage: boolean;
};

export function SubscriptionPanel({
  subscription,
  openCheckout,
  canManage,
}: SubscriptionPanelProps) {
  const router = useRouter();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [state, setState] = useState<BillingActionState>(initialBillingState);
  const [isPending, startTransition] = useTransition();

  const plan = getPlan(subscription.planId);
  const method = subscription.paymentMethod ? findPaymentMethod(subscription.paymentMethod) : null;

  function run(action: () => Promise<BillingActionState>) {
    setState(initialBillingState);

    startTransition(async () => {
      const result = await action();

      setState(result);
      setConfirmingCancel(false);

      if (result.status === "gelukt") router.refresh();
    });
  }

  return (
    <>
      <StatusAlert subscription={subscription} openCheckout={openCheckout} />

      {state.status === "gelukt" ? (
        <Alert variant="success" title={state.message} className="mb-4" />
      ) : null}
      {state.status === "fout" ? (
        <ErrorSummary error={state.message} className="mb-4" />
      ) : null}

      <Card className="mb-8">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Je abonnement</CardTitle>
            <p className="mt-1 text-sm text-fg-muted">{periodSentence(subscription)}</p>
          </div>
          <Badge variant={SUBSCRIPTION_STATUS_VARIANTS[subscription.status]} dot>
            {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{plan.name}</p>
            <Price
              subtotalInCents={plan.pricePerMonthInCents}
              suffix="/ maand"
              size="md"
              className="mt-1"
            />
            {method ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-subtle">
                <CreditCard aria-hidden="true" className="size-3.5" />
                Via {method.label}
              </p>
            ) : null}
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {subscription.status === "achterstallig" ? (
                <Link
                  href={ROUTES.billingCheckout(subscription.planId)}
                  className={buttonClasses("primary", "md")}
                >
                  Betaling in orde brengen
                </Link>
              ) : null}

              {subscription.status === "wachtend" && openCheckout ? (
                <Link
                  href={ROUTES.billingReturn(openCheckout.molliePaymentId)}
                  className={buttonClasses("secondary", "md")}
                >
                  Betaling opvolgen
                </Link>
              ) : null}

              {subscription.cancelAtPeriodEnd && subscription.status === "actief" ? (
                <Button
                  variant="secondary"
                  icon={<RotateCcw />}
                  isLoading={isPending}
                  loadingLabel="Bezig"
                  onClick={() => run(resumeSubscriptionAction)}
                >
                  Toch verderdoen
                </Button>
              ) : null}

              {!subscription.cancelAtPeriodEnd &&
              (subscription.status === "actief" ||
                subscription.status === "proef" ||
                subscription.status === "achterstallig") ? (
                <Button
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => setConfirmingCancel(true)}
                >
                  Opzeggen
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Modal
        open={confirmingCancel}
        onClose={() => !isPending && setConfirmingCancel(false)}
        size="sm"
      >
        <ModalHeader
          title="Abonnement opzeggen?"
          description={
            subscription.status === "proef"
              ? "Je proefperiode stopt meteen. Je projecten blijven staan."
              : `Er wordt niets meer afgeschreven. Je kan Immoreel nog gebruiken tot ${formatDate(subscription.currentPeriodEnd)}; daarna stoppen de renders. Je projecten blijven staan.`
          }
        />
        <ModalBody>
          <p className="text-sm text-fg-muted">
            Je kan tot die datum altijd nog van gedacht veranderen — dan loopt alles gewoon door
            zonder dat je opnieuw hoeft te betalen.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setConfirmingCancel(false)} disabled={isPending}>
            Toch niet
          </Button>
          <Button
            variant="danger"
            isLoading={isPending}
            loadingLabel="Bezig met opzeggen"
            onClick={() => run(cancelSubscriptionAction)}
          >
            Ja, opzeggen
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

/**
 * De melding boven het paneel.
 *
 * Alleen bij een toestand waar de klant iets aan moet doen. Een actief
 * abonnement krijgt géén balk: "alles is in orde" is precies wat de rest van de
 * pagina al laat zien.
 */
function StatusAlert({
  subscription,
  openCheckout,
}: {
  subscription: Subscription;
  openCheckout: CheckoutAttempt | null;
}) {
  if (subscription.status === "achterstallig") {
    return (
      <Alert variant="danger" title="Je laatste betaling is niet gelukt" className="mb-6">
        Je kan Immoreel voorlopig gewoon blijven gebruiken. Breng de betaling binnen zeven dagen in
        orde, anders stoppen de renders.
      </Alert>
    );
  }

  if (subscription.status === "wachtend") {
    return (
      <Alert variant="warning" title="Je betaling wordt verwerkt" className="mb-6">
        {openCheckout
          ? "Zodra je bank bevestigt, staat je abonnement op actief. Bij een domiciliëring kan dat een paar dagen duren."
          : "Zodra je bank bevestigt, staat je abonnement op actief."}
      </Alert>
    );
  }

  if (subscription.status === "opgezegd") {
    return (
      <Alert variant="info" title="Je hebt geen lopend abonnement" className="mb-6">
        Je projecten en huisstijl blijven bewaard. Kies hieronder een plan om weer video&apos;s te
        kunnen renderen.
      </Alert>
    );
  }

  if (subscription.status === "proef") {
    const days = daysUntil(subscription.trialEndsAt ?? subscription.currentPeriodEnd);

    if (days > 3) return null;

    return (
      <Alert variant="warning" title="Je proefperiode loopt bijna af" className="mb-6">
        Kies een plan zodat je zonder onderbreking verder kan. Je betaalt pas vanaf vandaag; de
        proefdagen worden niet aangerekend.
      </Alert>
    );
  }

  return null;
}
