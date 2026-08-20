import { Badge } from "@/components/ui/badge";
import { getPlan } from "@/lib/billing/plans";
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_VARIANTS } from "@/lib/billing/status";
import type { AdminSubscriptionSummary } from "@/types";

/**
 * De stand van een abonnement in één badge.
 *
 * `null` is hier geen fout maar een echte toestand: een kantoor dat de
 * facturatiepagina nooit geopend heeft, heeft nog geen abonnementsrij. Het
 * paneel maakt die niet alsnog aan (zie `src/db/admin-store.ts`), dus het zegt
 * wat het ziet: "geen rij".
 */
export function SubscriptionBadge({
  subscription,
}: {
  subscription: AdminSubscriptionSummary | null;
}) {
  if (!subscription) {
    return (
      <Badge variant="neutral" size="sm" title="Nog geen abonnementsrij: de proefperiode wordt pas bij het eerste bezoek aan de facturatiepagina weggeschreven.">
        Geen rij
      </Badge>
    );
  }

  return (
    <Badge variant={SUBSCRIPTION_STATUS_VARIANTS[subscription.status]} size="sm" dot>
      {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
    </Badge>
  );
}

export function PlanBadge({ subscription }: { subscription: AdminSubscriptionSummary | null }) {
  if (!subscription) return <span className="text-fg-subtle">—</span>;

  return (
    <span className="text-sm text-fg">
      {getPlan(subscription.planId).name}
      {subscription.pendingPlanId ? (
        <span className="text-fg-subtle">
          {" → "}
          {getPlan(subscription.pendingPlanId).name}
        </span>
      ) : null}
    </span>
  );
}
