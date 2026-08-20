import { getBillingStore } from "@/db/billing-store";
import { handle, jsonOk, notFound, requireApiSession } from "@/lib/api";
import { createLogger } from "@/lib/errors/logger";
import { applyPayment, loadSubscription } from "@/lib/billing/service";
import { MollieError } from "@/lib/mollie/client";

const log = createLogger("billing");

/**
 * De stand van één betaling, voor de terugkeerpagina.
 *
 * Na het betalen komt de klant terug op onze pagina, en de vraag daar is
 * simpel: is het gelukt? Het eerlijke antwoord is vaak "nog niet bekend". De
 * webhook van Mollie en de terugkeer van de klant zijn twee losse verzoeken die
 * elkaar in elke volgorde kunnen inhalen, en een SEPA-incasso staat sowieso
 * dagen op `pending`.
 *
 * Daarom haalt deze route de betaling zelf op bij Mollie zolang ze nog open
 * staat — dezelfde verwerking als de webhook, alleen eerder opgevraagd. Zodra
 * er een uitkomst is, komt het antwoord uit onze eigen store en wordt Mollie
 * niet meer lastiggevallen.
 *
 * Bij ontwikkelen op `localhost` is dit niet een vangnet maar het enige pad:
 * Mollie kan een webhook naar `localhost` nooit afleveren.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  return handle(async () => {
    const session = await requireApiSession("billing:manage");
    const { paymentId } = await params;
    const store = getBillingStore();

    // Het opzoeken van de afrekening is meteen de controle of ze van deze
    // organisatie is: een id uit de URL zegt op zichzelf niets.
    let attempt = await store.findCheckout(paymentId);
    if (!attempt || attempt.organisationId !== session.organisation.id) {
      throw notFound("Onbekende betaling.");
    }

    if (attempt.status === "open") {
      try {
        await applyPayment(paymentId);
        attempt = (await store.findCheckout(paymentId)) ?? attempt;
      } catch (error) {
        // Mollie even niet bereikbaar hoeft de pagina niet stuk te maken: die
        // vraagt het zo meteen opnieuw. De stand die we hebben gaat wel mee.
        if (!(error instanceof MollieError)) throw error;

        log.warn("status ophalen bij Mollie mislukt", { paymentId, reason: error.message });
      }
    }

    const subscription = await loadSubscription(session.organisation.id);

    // Een betaalstatus uit een cache is geen betaalstatus; `jsonOk` zet overal
    // `no-store`.
    return jsonOk({
      paymentId,
      status: attempt.status,
      planId: attempt.planId,
      purpose: attempt.purpose,
      method: attempt.method,
      amountInCents: attempt.amountInCents,
      failureReason: attempt.failureReason,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  });
}
