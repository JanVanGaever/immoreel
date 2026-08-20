import type { Metadata } from "next";
import { PaymentHistory } from "@/components/billing/payment-history";
import { PlanGrid } from "@/components/billing/plan-grid";
import { SubscriptionPanel } from "@/components/billing/subscription-panel";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { getBillingStore } from "@/db/billing-store";
import { ROLE_LABELS, can } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { loadSubscription } from "@/lib/billing/service";
import { isMollieConfigured, isTestMode } from "@/lib/mollie/config";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = { title: "Facturatie" };

/**
 * De facturatiepagina: waar je staat, wat je kan kiezen, en wat er betaald is.
 *
 * In die volgorde, en niet andersom. Wie hier komt heeft meestal geen zin om
 * te kopen maar een vraag over wat er al loopt — de plannen staan er wél, maar
 * pas onder het antwoord op die vraag.
 */
export default async function BillingPage() {
  const { organisation, role } = await requireSession();
  const canManage = can(role, "billing:manage");

  // `loadSubscription` haalt de klok erdoorheen: een proefperiode die voorbij
  // is of een opzegging waarvan de datum verstreken is, staat hierna op de
  // juiste status.
  const subscription = await loadSubscription(organisation.id);
  const store = getBillingStore();
  const invoices = await store.listInvoices(organisation.id);

  // Bij een lopende betaling hoort de knop om ze op te volgen; die heeft het
  // betaling-id van de afrekening nodig.
  const openCheckout =
    subscription.status === "wachtend" ? await store.findOpenCheckout(organisation.id) : null;

  return (
    <>
      <PageHeader
        title="Facturatie"
        description="Je abonnement, je plan en alles wat er afgeschreven is."
      />

      {!canManage ? (
        <Alert variant="info" title={`Je rol is ${ROLE_LABELS[role]}.`} className="mb-6">
          Alleen een {ROLE_LABELS.owner.toLowerCase()} kan het abonnement wijzigen of opzeggen. Je
          ziet hier wel wat er loopt.
        </Alert>
      ) : null}

      {!isMollieConfigured() && canManage ? (
        <Alert variant="warning" title="Betalingen staan nog niet aan" className="mb-6">
          Er is geen Mollie-sleutel ingesteld op deze omgeving. Zet <code>MOLLIE_API_KEY</code> in
          je <code>.env</code>; tot dan kan je geen plan afsluiten.
        </Alert>
      ) : isTestMode() && canManage ? (
        <Alert variant="info" title="Testmodus" className="mb-6">
          Deze omgeving hangt aan een testsleutel van Mollie. Betalingen doorlopen het echte
          betaalscherm, maar er wordt niets afgeschreven.
        </Alert>
      ) : null}

      <SubscriptionPanel
        subscription={subscription}
        openCheckout={openCheckout}
        canManage={canManage}
      />

      <SectionHeader
        title="Plannen"
        description="Alle prijzen per maand en exclusief btw. Maandelijks opzegbaar."
      />
      <PlanGrid subscription={subscription} canManage={canManage} />

      <div className="mt-10">
        <SectionHeader
          title="Betalingen"
          description={`Elke afschrijving en elke mislukte poging. Vragen over een bedrag? Mail naar ${SUPPORT_EMAIL}.`}
        />
        <PaymentHistory invoices={invoices} />
      </div>
    </>
  );
}
