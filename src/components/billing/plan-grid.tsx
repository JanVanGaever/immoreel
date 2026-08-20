"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlanCard } from "@/components/billing/plan-card";
import { Price } from "@/components/billing/price";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { initialBillingState, type BillingActionState } from "@/lib/billing/action-state";
import { changePlanAction } from "@/lib/billing/actions";
import { planChange } from "@/lib/billing/changes";
import { PLAN_LIST } from "@/lib/billing/plans";
import { ROUTES } from "@/lib/constants";
import type { Plan, Subscription } from "@/types";

/**
 * De plannenlijst met de wissel erachter.
 *
 * Tussen klikken en wisselen zit één venster, en dat venster bestaat om één
 * reden: hier staat wat het kost en wanneer het ingaat. Bij een upgrade wordt
 * er meteen geïncasseerd op een machtiging die de klant ooit gaf — dat mag geen
 * verrassing zijn, ook al is er geen betaalscherm meer aan te pas gekomen.
 */

export type PlanGridProps = {
  subscription: Subscription;
  /** Alleen een eigenaar mag wisselen; de rest ziet de prijzen wel. */
  canManage: boolean;
};

export function PlanGrid({ subscription, canManage }: PlanGridProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Plan | null>(null);
  const [state, setState] = useState<BillingActionState>(initialBillingState);
  const [isPending, startTransition] = useTransition();

  const change = selected ? planChange(subscription, selected.id) : null;

  function close() {
    if (isPending) return;

    setSelected(null);
    setState(initialBillingState);
  }

  function confirm() {
    if (!selected || !change) return;

    // Geen mandaat: dan hoort hier geen incasso maar een betaalscherm.
    if (change.needsCheckout) {
      router.push(ROUTES.billingCheckout(selected.id));
      return;
    }

    setState(initialBillingState);

    startTransition(async () => {
      const result = await changePlanAction(selected.id);

      if (result.status === "checkout-nodig") {
        router.push(ROUTES.billingCheckout(result.planId));
        return;
      }

      if (result.status === "betaling-gestart") {
        // De bijbetaling loopt; de terugkeerpagina volgt hem tot het einde.
        router.push(ROUTES.billingReturn(result.paymentId));
        return;
      }

      if (result.status === "gelukt") {
        setSelected(null);
        setState(result);
        router.refresh();
        return;
      }

      setState(result);
    });
  }

  return (
    <>
      {state.status === "gelukt" ? (
        <Alert variant="success" title={state.message} className="mb-4" />
      ) : null}

      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        {PLAN_LIST.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            change={planChange(subscription, plan.id)}
            isCurrent={plan.id === subscription.planId}
            isPending={plan.id === subscription.pendingPlanId}
            disabled={!canManage || isPending}
            onSelect={setSelected}
          />
        ))}
      </div>

      <Modal open={Boolean(selected)} onClose={close} closeOnBackdropClick={false} size="sm">
        {selected && change ? (
          <>
            <ModalHeader
              title={
                change.kind === "start"
                  ? `${selected.name} afsluiten`
                  : `${change.actionLabel} naar ${selected.name}`
              }
              description={change.summary}
            />

            <ModalBody className="space-y-4">
              {state.status === "fout" ? <Alert variant="danger" title={state.message} /> : null}

              <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-subtle px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">Nu te betalen</p>
                  <p className="mt-0.5 text-xs text-fg-subtle">
                    {change.needsCheckout
                      ? "Je kiest hierna je betaalmethode."
                      : change.chargeNowInCents > 0
                        ? "Wordt afgeschreven op je bestaande machtiging."
                        : "Deze wissel kost je vandaag niets."}
                  </p>
                </div>
                <Price subtotalInCents={change.chargeNowInCents} size="sm" className="text-right" />
              </div>

              <div className="flex items-start justify-between gap-4 px-1">
                <p className="text-sm text-fg-muted">Vanaf je volgende maand</p>
                <Price
                  subtotalInCents={selected.pricePerMonthInCents}
                  suffix="/ maand"
                  size="sm"
                  className="text-right"
                />
              </div>
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" onClick={close} disabled={isPending}>
                Annuleren
              </Button>
              <Button onClick={confirm} isLoading={isPending} loadingLabel="Bezig met wisselen">
                {change.needsCheckout
                  ? "Doorgaan naar betalen"
                  : change.chargeNowInCents > 0
                    ? "Bevestigen en betalen"
                    : "Bevestigen"}
              </Button>
            </ModalFooter>
          </>
        ) : null}
      </Modal>
    </>
  );
}
