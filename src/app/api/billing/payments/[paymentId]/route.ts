import { NextResponse } from "next/server";
import { getBillingStore } from "@/db/billing-store";
import { can } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { applyPayment, loadSubscription } from "@/lib/billing/service";
import { MollieError } from "@/lib/mollie/client";

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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  if (!can(session.role, "billing:manage")) {
    return NextResponse.json({ error: "Onvoldoende rechten." }, { status: 403 });
  }

  const { paymentId } = await params;
  const store = getBillingStore();

  // Het opzoeken van de afrekening is meteen de controle of ze van deze
  // organisatie is: een id uit de URL zegt op zichzelf niets.
  let attempt = await store.findCheckout(paymentId);
  if (!attempt || attempt.organisationId !== session.organisation.id) {
    return NextResponse.json({ error: "Onbekende betaling." }, { status: 404 });
  }

  if (attempt.status === "open") {
    try {
      await applyPayment(paymentId);
      attempt = (await store.findCheckout(paymentId)) ?? attempt;
    } catch (error) {
      // Mollie even niet bereikbaar hoeft de pagina niet stuk te maken: die
      // vraagt het zo meteen opnieuw. De stand die we hebben gaat wel mee.
      if (!(error instanceof MollieError)) throw error;

      console.warn(`[billing] status ophalen mislukt voor ${paymentId}: ${error.message}`);
    }
  }

  const subscription = await loadSubscription(session.organisation.id);

  return NextResponse.json(
    {
      paymentId,
      status: attempt.status,
      planId: attempt.planId,
      purpose: attempt.purpose,
      method: attempt.method,
      amountInCents: attempt.amountInCents,
      failureReason: attempt.failureReason,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    // Een betaalstatus uit een cache is geen betaalstatus.
    { headers: { "Cache-Control": "no-store" } },
  );
}
