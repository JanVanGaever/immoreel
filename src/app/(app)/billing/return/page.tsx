import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaymentResult } from "@/components/billing/payment-result";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { isMolliePaymentId } from "@/lib/mollie/config";
import { firstSearchParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Betaling" };

type PageProps = {
  searchParams: Promise<{ payment?: string | string[] }>;
};

/**
 * Waar Mollie de klant naartoe stuurt na het betalen.
 *
 * Deze pagina beslist niets. Dat de klant hier aankomt, betekent alleen dat het
 * betaalscherm klaar is — niet dat er betaald is, en zeker niet dat het gelukt
 * is: iemand die halverwege op "terug" duwt, komt hier ook terecht. Wat er
 * effectief gebeurd is, staat bij Mollie, en het component hieronder gaat het
 * daar halen.
 *
 * De pagina zelf is bewust een server component zonder data: alles wat hier
 * gerenderd wordt zou binnen een seconde verouderd zijn.
 */
export default async function BillingReturnPage({ searchParams }: PageProps) {
  await requirePermission("billing:manage");

  const paymentId = firstSearchParam((await searchParams).payment);

  // Zonder betaling-id valt er niets te tonen. Dit gebeurt als iemand het adres
  // los intypt of als een terugkeer-URL onderweg gehavend raakt.
  if (!isMolliePaymentId(paymentId)) redirect(ROUTES.billing);

  return (
    <div className="mx-auto w-full max-w-xl">
      <PageHeader title="Je betaling" />
      <PaymentResult paymentId={paymentId} />
    </div>
  );
}
