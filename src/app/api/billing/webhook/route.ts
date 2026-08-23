import { NextResponse } from "next/server";
import { createLogger } from "@/lib/errors/logger";
import { applyPayment } from "@/lib/billing/service";
import { MollieError } from "@/lib/mollie/client";
import { isMollieConfigured, isMolliePaymentId } from "@/lib/mollie/config";

const log = createLogger("billing");

/**
 * De webhook van Mollie.
 *
 * Hier komt binnen dat er iets veranderd is aan een betaling — een eerste
 * betaling die gelukt is, een maandelijkse incasso die mislukt is. Zonder deze
 * route weet de app nooit dat er betaald is.
 *
 * **Wat er binnenkomt, is niets waard.** Mollie stuurt één veld — `id=tr_...` —
 * in een gewoon formulier, zonder handtekening en zonder geheim. Er valt dus
 * niets te verifiëren aan dit verzoek, en het is een vergissing om het te
 * proberen: iedereen die het adres kent kan er een id in gooien. De beveiliging
 * zit erin dat we het id alleen gebruiken om de betaling *op te halen* bij
 * Mollie, met onze eigen sleutel. Wat die aanroep teruggeeft is de waarheid;
 * wat in dit verzoek stond is hoogstens een tip. Zie `applyPayment()`.
 *
 * **De antwoordcode stuurt Mollie aan.** Alles behalve een 2xx betekent voor
 * Mollie "kom terug", en dat doet hij — met toenemende tussenpozen, ruim een
 * dag lang. Daarom:
 *
 * - Verwerkt, of niets mee te doen: **200**. Ook bij een betaling die we niet
 *   thuis kunnen brengen; die komt door herhalen niet alsnog goed.
 * - Mollie zelf onbereikbaar of iets kapot aan onze kant: **500**, zodat het
 *   opnieuw geprobeerd wordt.
 *
 * En omdat er herhaald wordt, moet alles erachter tegen dubbel verwerken
 * kunnen. Dat zit in `recordInvoice()` (upsert op de betaal-id) en in de
 * statusovergangen, die allemaal naar een eindtoestand schrijven in plaats van
 * een stap te zetten.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isMollieConfigured()) {
    // Zonder sleutel kunnen we de betaling niet ophalen en dus niets
    // vaststellen. Een 500 laat Mollie het later opnieuw proberen — tegen die
    // tijd staat de sleutel er misschien.
    log.error("webhook binnengekomen zonder MOLLIE_API_KEY");

    return NextResponse.json({ error: "Betalingen niet geconfigureerd." }, { status: 500 });
  }

  const paymentId = await readPaymentId(request);

  if (!paymentId) {
    // Geen bruikbaar id: dit verzoek komt niet van Mollie, of niet van een
    // versie die we kennen. Herhalen verandert daar niets aan.
    return NextResponse.json({ error: "Geen betaling-id." }, { status: 200 });
  }

  try {
    const outcome = await applyPayment(paymentId);
    log.info("webhook verwerkt", { paymentId, reason: outcome.reason });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    if (error instanceof MollieError && isUnresolvable(error)) {
      // Mollie kent deze betaling niet en zal ze ook niet leren kennen. Dit
      // nog twintig keer opnieuw krijgen helpt niemand.
      log.error("webhook definitief mislukt; niet meer herhalen", error, { paymentId });

      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Alle andere fouten — Mollie eruit, ons netwerk stuk, onze sleutel
    // geweigerd — zeggen niets over de betaling zelf. Juist dan moet Mollie
    // terugkomen: een verkeerd geconfigureerde sleutel is over een uur
    // misschien rechtgezet, en tot dan is een 200 een betaling die we voorgoed
    // gemist hebben.
    log.error("webhook mislukt; Mollie mag herhalen", error, { paymentId });

    return NextResponse.json({ error: "Tijdelijke fout." }, { status: 500 });
  }
}

/**
 * Is deze betaling nooit meer op te halen?
 *
 * Alleen als Mollie zegt dat ze niet bestaat. Een 401 valt hier bewust buiten:
 * dat gaat over ónze sleutel en niet over de betaling, en zoiets hoort
 * hersteld te worden en niet weggeslikt.
 */
function isUnresolvable(error: MollieError): boolean {
  return error.status === 404 || error.status === 410;
}

/**
 * Het betaling-id uit het verzoek.
 *
 * Mollie stuurt `application/x-www-form-urlencoded`. JSON accepteren we er
 * gratis bij: dat scheelt gepruts bij het naspelen van een webhook met curl, en
 * het maakt niets onveiliger — het id wordt hoe dan ook alleen gebruikt om bij
 * Mollie te gaan kijken.
 */
async function readPaymentId(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  let raw: unknown = null;

  try {
    if (contentType.includes("application/json")) {
      raw = ((await request.json()) as Record<string, unknown>).id;
    } else {
      raw = (await request.formData()).get("id");
    }
  } catch {
    return null;
  }

  // De vorm controleren voor we ermee naar Mollie gaan: een id met vreemde
  // tekens erin hoort niet in een URL terecht te komen.
  return isMolliePaymentId(raw) ? raw : null;
}
