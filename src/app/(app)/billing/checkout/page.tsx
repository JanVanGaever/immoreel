import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getPlan, isPlanId } from "@/lib/billing/plans";
import { loadSubscription } from "@/lib/billing/service";
import { isMollieConfigured, isTestMode } from "@/lib/mollie/config";
import { ROUTES } from "@/lib/constants";
import { firstSearchParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Afrekenen" };

type PageProps = {
  searchParams: Promise<{ plan?: string | string[] }>;
};

/**
 * De stap tussen "dit plan wil ik" en het betaalscherm van Mollie.
 *
 * Een tussenstap die je zou kunnen overslaan, en dat zou een fout zijn: hier
 * kiest de klant zijn betaalmethode én leest hij dat hij een doorlopende
 * machtiging afgeeft. Dat laatste hoort niet pas te blijken op het scherm van
 * zijn bank.
 *
 * Alleen een eigenaar komt hier; wie het recht mist gaat terug naar het
 * dashboard (`requirePermission`).
 */
export default async function BillingCheckoutPage({ searchParams }: PageProps) {
  const { organisation } = await requirePermission("billing:manage");
  const requested = firstSearchParam((await searchParams).plan);

  // Zonder geldig plan valt er niets af te rekenen; terug naar de lijst waar de
  // keuze wél gemaakt kan worden.
  if (!isPlanId(requested)) redirect(ROUTES.billing);

  const subscription = await loadSubscription(organisation.id);
  const plan = getPlan(requested);

  return (
    <>
      <PageHeader
        title={`${plan.name} afsluiten`}
        description="Kies hoe je betaalt. Je gaat daarna naar het beveiligde scherm van Mollie."
      />

      <CheckoutForm
        plan={plan}
        subscription={subscription}
        isTestMode={isTestMode()}
        isConfigured={isMollieConfigured()}
      />
    </>
  );
}
