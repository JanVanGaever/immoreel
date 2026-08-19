import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
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
import { EmptyState } from "@/components/ui/empty-state";
import { PLAN_LIST, RECOMMENDED_PLAN_ID } from "@/lib/billing";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Facturatie" };

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="Facturatie"
        description="Abonnement, verbruik en facturen. Betaalprovider volgt later."
        actions={<Button variant="secondary">Abonnement beheren</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_LIST.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <div>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </div>
              {plan.id === RECOMMENDED_PLAN_ID ? <Badge variant="brand">Populair</Badge> : null}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatCurrency(plan.pricePerMonthInCents)}
                <span className="ml-1 text-sm font-normal text-fg-muted">/ maand</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-fg-muted">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                variant={plan.id === RECOMMENDED_PLAN_ID ? "primary" : "secondary"}
                className="w-full"
              >
                Kiezen
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <SectionHeader title="Facturen" description="Je facturen in PDF, zodra er facturatie is." />
        <EmptyState icon={Receipt} title="Nog geen facturen" />
      </div>
    </>
  );
}
