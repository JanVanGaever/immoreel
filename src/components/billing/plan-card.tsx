"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { Price } from "@/components/billing/price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RECOMMENDED_PLAN_ID } from "@/lib/billing/plans";
import type { PlanChange } from "@/lib/billing/changes";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types";

/**
 * Eén plan in de lijst.
 *
 * De knop zegt wat er zou gebeuren — "Upgraden", "Downgraden", "Kiezen" — en
 * niet overal hetzelfde. Bij een plannenlijst waar alle knoppen "Kiezen" heten,
 * moet de klant zelf uitrekenen of hij vooruit of achteruit gaat, en juist dat
 * is de vraag waar hij op dat moment mee zit.
 */

export type PlanCardProps = {
  plan: Plan;
  /** Wat er gebeurt als de klant hierop klikt; komt uit `planChange()`. */
  change: PlanChange;
  isCurrent: boolean;
  /** Dit plan staat klaar voor de volgende periode. */
  isPending: boolean;
  disabled?: boolean;
  onSelect: (plan: Plan) => void;
  className?: string;
};

export function PlanCard({
  plan,
  change,
  isCurrent,
  isPending,
  disabled = false,
  onSelect,
  className,
}: PlanCardProps) {
  const isRecommended = plan.id === RECOMMENDED_PLAN_ID;

  return (
    <Card
      className={cn(
        "flex flex-col",
        isCurrent && "border-brand ring-1 ring-brand/30",
        className,
      )}
    >
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{plan.name}</CardTitle>
          <CardDescription>{plan.description}</CardDescription>
        </div>
        {isCurrent ? (
          <Badge variant="brand">Huidig</Badge>
        ) : isPending ? (
          <Badge variant="info">Vanaf volgende maand</Badge>
        ) : isRecommended ? (
          <Badge variant="accent">Populair</Badge>
        ) : null}
      </CardHeader>

      <CardContent className="flex-1">
        <Price subtotalInCents={plan.pricePerMonthInCents} suffix="/ maand" size="lg" />

        <ul className="mt-4 space-y-2 text-sm text-fg-muted">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2">
        <Button
          variant={change.kind === "upgrade" || isRecommended ? "primary" : "secondary"}
          disabled={disabled || change.kind === "gelijk"}
          icon={
            change.kind === "upgrade" ? (
              <ArrowUp />
            ) : change.kind === "downgrade" ? (
              <ArrowDown />
            ) : undefined
          }
          onClick={() => onSelect(plan)}
          className="w-full"
        >
          {change.actionLabel}
        </Button>

        {change.kind !== "gelijk" ? (
          <p className="text-[0.6875rem] leading-snug text-fg-subtle">
            {change.effectiveAt === "meteen" ? "Gaat meteen in." : "Gaat in bij je volgende maand."}
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}
