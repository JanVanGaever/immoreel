import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_VARIANTS,
  getPlan,
  periodSentence,
  subscriptionNeedsAction,
} from "@/lib/billing";
import { ROUTES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { SubscriptionSummary } from "@/types";

export type SubscriptionCardProps = {
  subscription: SubscriptionSummary | null;
  /** Alleen een eigenaar kan het abonnement wijzigen. */
  mayManage?: boolean;
  className?: string;
};

/** Status van het abonnement, met de weg naar facturatie. */
export function SubscriptionCard({
  subscription,
  mayManage = false,
  className,
}: SubscriptionCardProps) {
  if (!subscription) {
    return (
      <Card className={className}>
        <CardHeader>
          <div>
            <CardTitle>Abonnement</CardTitle>
            <CardDescription>Nog geen plan gekozen voor dit kantoor.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Link href={ROUTES.billing} className={buttonClasses("primary", "sm", "w-full")}>
            Plan kiezen
          </Link>
        </CardContent>
      </Card>
    );
  }

  const plan = getPlan(subscription.planId);
  const needsAction = subscriptionNeedsAction(subscription.status);

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Abonnement</CardTitle>
          <CardDescription>{plan.description}</CardDescription>
        </div>
        <Badge variant={SUBSCRIPTION_STATUS_VARIANTS[subscription.status]} dot>
          {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {plan.name}
          <span className="ml-2 text-sm font-normal text-fg-muted">
            {formatCurrency(plan.pricePerMonthInCents)} / maand
          </span>
        </p>
        <p className="mt-1.5 text-sm text-fg-muted">{periodSentence(subscription)}</p>

        <Link
          href={ROUTES.billing}
          className={buttonClasses(needsAction ? "primary" : "secondary", "sm", "mt-4 w-full")}
        >
          {needsAction
            ? "Betaling in orde brengen"
            : mayManage
              ? "Abonnement beheren"
              : "Facturatie bekijken"}
        </Link>
      </CardContent>
    </Card>
  );
}
