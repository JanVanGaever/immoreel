import { getBillingStore } from "@/db/billing-store";
import { nextPeriod, planChange, toMollieDate } from "@/lib/billing/changes";
import { describeInvoice, failureMessage, invoiceStatusFor } from "@/lib/billing/invoices";
import { findPaymentMethod, fromMollieMethod } from "@/lib/billing/methods";
import { VAT_RATE, getPlan, grossPriceInCents, priceBreakdown } from "@/lib/billing/plans";
import { APP_NAME } from "@/lib/constants";
import { notify } from "@/lib/notifications/service";
import {
  cancelSubscription as cancelMollieSubscription,
  checkoutUrl,
  createCustomer,
  createPayment,
  createSubscription,
  findValidMandate,
  getPayment,
} from "@/lib/mollie/api";
import type { MolliePayment } from "@/lib/mollie/types";
import type {
  ID,
  Organisation,
  PaymentMethodId,
  PaymentPurpose,
  PlanId,
  Subscription,
  User,
} from "@/types";

/**
 * De brug tussen Mollie en de store.
 *
 * Alles wat geld raakt staat hier, en het staat hier één keer: het scherm van
 * de klant en de webhook van Mollie roepen dezelfde functies aan. Dat is geen
 * netheid — het is de enige manier waarop "wat de klant ziet" en "wat er
 * geïncasseerd wordt" niet uit elkaar kunnen lopen.
 *
 * De volgorde van dit bestand is die van een abonnement: klant worden, de
 * eerste betaling, wat er ná een betaling moet gebeuren, en tot slot wisselen
 * en opzeggen.
 *
 * Alleen op de server: elke functie hier heeft de Mollie-sleutel nodig, en die
 * hoort nooit in een bundel voor de browser.
 */

/* -------------------------------------------------------------------------
 * Bijwerken van wat de tijd gedaan heeft
 * ---------------------------------------------------------------------- */

/**
 * Het abonnement van deze organisatie, met de klok erdoorheen gehaald.
 *
 * Een proefperiode die afgelopen is en een opzegging waarvan de datum voorbij
 * is, veranderen niets aan de databank tot iemand kijkt. Dit is die blik. Het
 * alternatief — een geplande taak die elke nacht alle abonnementen naloopt —
 * is meer bewegende delen voor een toestand die alleen telt op het moment dat
 * er iemand naar kijkt of iets probeert.
 */
export async function loadSubscription(organisationId: ID): Promise<Subscription> {
  const store = getBillingStore();
  const subscription = await store.getSubscription(organisationId);
  const now = Date.now();
  const periodEnded = new Date(subscription.currentPeriodEnd).getTime() <= now;

  if (!periodEnded) return subscription;

  if (subscription.status === "proef") {
    return store.updateSubscription(organisationId, { status: "opgezegd", trialEndsAt: null });
  }

  if (subscription.cancelAtPeriodEnd && subscription.status === "actief") {
    return store.updateSubscription(organisationId, {
      status: "opgezegd",
      mollieSubscriptionId: null,
    });
  }

  return subscription;
}

/* -------------------------------------------------------------------------
 * Klant worden
 * ---------------------------------------------------------------------- */

/**
 * De klant bij Mollie, aangemaakt zodra hij nodig is en daarna hergebruikt.
 *
 * Zonder klant is er geen mandaat, en zonder mandaat geen tweede maand. Het is
 * dus geen optionele netheid maar de eerste stap van elke betaling die zich
 * herhaalt.
 */
async function ensureCustomer(
  organisation: Organisation,
  user: User,
  subscription: Subscription,
): Promise<string> {
  if (subscription.mollieCustomerId) return subscription.mollieCustomerId;

  const customer = await createCustomer({
    name: organisation.name,
    email: user.email,
    metadata: { organisationId: organisation.id },
  });

  await getBillingStore().updateSubscription(organisation.id, {
    mollieCustomerId: customer.id,
  });

  return customer.id;
}

/* -------------------------------------------------------------------------
 * De eerste betaling
 * ---------------------------------------------------------------------- */

export type StartCheckoutInput = {
  organisation: Organisation;
  user: User;
  planId: PlanId;
  method: PaymentMethodId;
  purpose: Extract<PaymentPurpose, "start" | "herkansing">;
};

export type StartCheckoutResult = {
  paymentId: string;
  /** Waar de klant naartoe moet. `null` betekent dat Mollie geen scherm gaf. */
  checkoutUrl: string | null;
};

/**
 * De klant naar het betaalscherm van Mollie sturen.
 *
 * Dit is een betaling van het type `first`: ze int de eerste maand én levert
 * het mandaat op waarmee de maanden daarna vanzelf gaan. Het abonnement bij
 * Mollie wordt hier nog níet aangemaakt — dat gebeurt pas als de betaling
 * gelukt is, want een abonnement op een mandaat dat er niet gekomen is, is een
 * incasso die elke maand faalt.
 *
 * Het abonnement gaat lokaal op `wachtend`. Zo weet elk scherm dat er iets
 * loopt, ook als de klant zijn tabblad sluit voor hij terug is.
 */
export async function startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  const store = getBillingStore();
  const subscription = await store.getSubscription(input.organisation.id);
  const customerId = await ensureCustomer(input.organisation, input.user, subscription);
  const plan = getPlan(input.planId);
  const amountInCents = grossPriceInCents(plan.pricePerMonthInCents);

  const payment = await createPayment({
    amountInCents,
    description: `${APP_NAME} ${plan.name} — ${describeInvoice(input.purpose, input.planId)}`,
    customerId,
    sequenceType: "first",
    method: findPaymentMethod(input.method).mollieMethod,
    // Wat hier in gaat, komt via de API terug bij de webhook. Omdat we het
    // dáár ophalen en niet uit het verzoek van Mollie lezen, is het te
    // vertrouwen — zie `app/api/billing/webhook/route.ts`.
    metadata: {
      organisationId: input.organisation.id,
      planId: input.planId,
      purpose: input.purpose,
      method: input.method,
    },
  });

  await store.createCheckout({
    organisationId: input.organisation.id,
    molliePaymentId: payment.id,
    planId: input.planId,
    purpose: input.purpose,
    method: input.method,
    amountInCents,
    checkoutUrl: checkoutUrl(payment),
  });

  await store.updateSubscription(input.organisation.id, { status: "wachtend" });

  return { paymentId: payment.id, checkoutUrl: checkoutUrl(payment) };
}

/* -------------------------------------------------------------------------
 * Wat er na een betaling gebeurt
 * ---------------------------------------------------------------------- */

export type PaymentOutcome = {
  handled: boolean;
  /** Voor de logregel; niet voor de klant. */
  reason: string;
};

/**
 * Eén betaling verwerken, wat er ook mee gebeurd is.
 *
 * Dit is het hart van de webhook en tegelijk wat de terugkeerpagina aanroept
 * als de webhook nog niet geweest is. Beide paden mogen elkaar overlappen:
 * alles hieronder is zo geschreven dat twee keer verwerken hetzelfde oplevert
 * als één keer.
 */
export async function applyPayment(paymentId: string): Promise<PaymentOutcome> {
  // De webhook stuurt alleen een id mee. Pas dít antwoord is te vertrouwen.
  const payment = await getPayment(paymentId);
  const store = getBillingStore();

  const organisationId = await resolveOrganisationId(payment);
  if (!organisationId) {
    // Een betaling die we niet thuis kunnen brengen is geen fout van Mollie en
    // ook niet iets om op te herhalen: waarschijnlijk hoort ze bij een andere
    // omgeving die dezelfde Mollie-account gebruikt.
    return { handled: false, reason: `Geen organisatie voor betaling ${payment.id}.` };
  }

  const purpose = resolvePurpose(payment);
  const planId = resolvePlanId(payment, await store.getSubscription(organisationId));
  const method = fromMollieMethod(payment.method);

  const invoice = await store.recordInvoice({
    organisationId,
    molliePaymentId: payment.id,
    status: invoiceStatusFor(payment.status),
    purpose,
    planId,
    subtotalInCents: subtotalOf(payment),
    method,
    paidAt: payment.paidAt ?? null,
    failureReason: failureMessage(payment),
  });

  if (payment.status === "paid") {
    await onPaid({ payment, organisationId, purpose, planId, method });

    // Na het verwerken en niet ervoor: een melding over een betaling die daarna
    // alsnog stukloopt, is erger dan geen melding. `notify()` gooit nooit, dus
    // de webhook blijft hierdoor niet hangen (zie lib/notifications/service.ts).
    await notify({
      topic: "betaling-gelukt",
      organisationId,
      invoiceId: invoice.id,
      amountInCents: invoice.amountInCents,
      planId,
    });

    return { handled: true, reason: `Betaling ${payment.id} verwerkt als ${purpose}.` };
  }

  if (isFinalFailure(payment)) {
    await onFailed({ payment, organisationId, purpose });

    await notify({
      topic: "betaling-mislukt",
      organisationId,
      invoiceId: invoice.id,
      amountInCents: invoice.amountInCents,
      reason: failureMessage(payment),
    });

    return { handled: true, reason: `Betaling ${payment.id} mislukt (${payment.status}).` };
  }

  // `open`, `pending` of `authorized`: nog onderweg. De factuurregel staat er
  // al; er valt verder niets te beslissen tot Mollie opnieuw belt.
  return { handled: true, reason: `Betaling ${payment.id} staat op ${payment.status}.` };
}

async function onPaid(context: {
  payment: MolliePayment;
  organisationId: ID;
  purpose: PaymentPurpose;
  planId: PlanId;
  method: PaymentMethodId | null;
}): Promise<void> {
  const store = getBillingStore();
  const { payment, organisationId, purpose, planId, method } = context;
  const subscription = await store.getSubscription(organisationId);

  await store.settleCheckout(payment.id, "geslaagd");

  if (purpose === "start" || purpose === "herkansing") {
    const period = nextPeriod(payment.paidAt ?? new Date().toISOString());

    // Het mandaat komt uit de betaling zelf, en anders uit de mandatenlijst van
    // de klant: bij Bancontact staat het soms pas een tel later op de betaling.
    const mandateId =
      payment.mandateId ??
      (payment.customerId ? ((await findValidMandate(payment.customerId))?.id ?? null) : null);

    const mollieSubscriptionId = mandateId
      ? await ensureMollieSubscription({
          organisationId,
          customerId: payment.customerId!,
          planId,
          mandateId,
          startDate: period.end,
          existingId: subscription.mollieSubscriptionId ?? null,
        })
      : null;

    await store.updateSubscription(organisationId, {
      planId,
      status: "actief",
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      pendingPlanId: null,
      paymentMethod: method ?? subscription.paymentMethod ?? null,
      mollieCustomerId: payment.customerId ?? subscription.mollieCustomerId ?? null,
      mollieMandateId: mandateId,
      mollieSubscriptionId,
    });

    return;
  }

  if (purpose === "upgrade") {
    // De periode blijft staan: er is bijbetaald voor de rest van deze maand,
    // niet voor een nieuwe.
    await store.updateSubscription(organisationId, { planId, status: "actief" });

    return;
  }

  // Verlenging: de periode schuift op, en een geplande downgrade gaat nu in.
  const period = nextPeriod(subscription.currentPeriodEnd);

  await store.updateSubscription(organisationId, {
    planId: subscription.pendingPlanId ?? subscription.planId,
    status: "actief",
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    pendingPlanId: null,
  });
}

async function onFailed(context: {
  payment: MolliePayment;
  organisationId: ID;
  purpose: PaymentPurpose;
}): Promise<void> {
  const store = getBillingStore();
  const { payment, organisationId, purpose } = context;
  const subscription = await store.getSubscription(organisationId);
  const reason = failureMessage(payment);

  await store.settleCheckout(payment.id, "mislukt", reason);

  if (purpose === "start") {
    // Nooit betaald: terug naar waar hij vandaan kwam. Een proefperiode die nog
    // loopt, hoort niet te sneuvelen omdat een kaart geweigerd werd.
    const trialRunning =
      subscription.trialEndsAt && new Date(subscription.trialEndsAt).getTime() > Date.now();

    await store.updateSubscription(organisationId, {
      status: trialRunning ? "proef" : "opgezegd",
    });

    return;
  }

  // Verlenging, upgrade of herkansing: er was een lopend abonnement en de
  // incasso is niet doorgegaan. De dienst blijft draaien; het scherm zegt wat
  // er moet gebeuren (zie `hasBillingAccess`).
  await store.updateSubscription(organisationId, { status: "achterstallig" });
}

/**
 * Het abonnement bij Mollie, dat vanaf de volgende periode elke maand int.
 *
 * Bestaat er al een, dan blijft die staan: dit wordt aangeroepen vanuit de
 * webhook, en die kan twee keer komen. Een tweede abonnement zou een tweede
 * incasso per maand betekenen.
 */
async function ensureMollieSubscription(input: {
  organisationId: ID;
  customerId: string;
  planId: PlanId;
  mandateId: string;
  startDate: string;
  existingId: string | null;
}): Promise<string> {
  if (input.existingId) return input.existingId;

  const plan = getPlan(input.planId);
  const subscription = await createSubscription({
    customerId: input.customerId,
    amountInCents: grossPriceInCents(plan.pricePerMonthInCents),
    description: `${APP_NAME} ${plan.name} — maandabonnement`,
    mandateId: input.mandateId,
    startDate: toMollieDate(input.startDate),
    metadata: { organisationId: input.organisationId, planId: input.planId },
    // Twee webhooks voor dezelfde betaling mogen niet twee abonnementen geven.
    idempotencyKey: `sub-${input.organisationId}-${input.planId}-${toMollieDate(input.startDate)}`,
  });

  return subscription.id;
}

/* -------------------------------------------------------------------------
 * Van plan wisselen
 * ---------------------------------------------------------------------- */

export type ApplyPlanChangeResult =
  | { outcome: "gewijzigd"; subscription: Subscription }
  /** Er is bijbetaald op het bestaande mandaat; de wissel volgt uit de webhook. */
  | { outcome: "betaling-gestart"; paymentId: string }
  | { outcome: "checkout-nodig" };

/**
 * Upgraden of downgraden op een bestaand mandaat.
 *
 * Beide gevallen zijn hier bewust verschillend afgehandeld, en dat verschil is
 * uitgelegd in `changes.ts`: upgraden gaat meteen in en kost een pro-rata
 * bijbetaling, downgraden gaat in als de betaalde periode om is en kost nu
 * niets.
 */
export async function applyPlanChange(
  organisation: Organisation,
  planId: PlanId,
): Promise<ApplyPlanChangeResult> {
  const store = getBillingStore();
  const subscription = await loadSubscription(organisation.id);
  const change = planChange(subscription, planId);

  if (change.needsCheckout) return { outcome: "checkout-nodig" };

  if (change.kind === "downgrade") {
    // Het abonnement bij Mollie int nog het oude bedrag. We vervangen het door
    // een nieuw dat begint waar de betaalde periode eindigt; tot dan verandert
    // er voor de klant niets.
    const replacement = await replaceMollieSubscription({
      subscription,
      planId,
      startDate: subscription.currentPeriodEnd,
    });

    return {
      outcome: "gewijzigd",
      subscription: await store.updateSubscription(organisation.id, {
        pendingPlanId: planId,
        mollieSubscriptionId: replacement,
        cancelAtPeriodEnd: false,
      }),
    };
  }

  // Upgrade. Eerst het abonnement bij Mollie op het nieuwe bedrag zetten, dan
  // pas bijbetalen: gaat de incasso mis, dan staat het nieuwe tarief er al —
  // en dat is beter dan een klant die het grote plan gebruikt en het kleine
  // betaalt.
  const replacement = await replaceMollieSubscription({
    subscription,
    planId,
    startDate: subscription.currentPeriodEnd,
  });

  await store.updateSubscription(organisation.id, {
    mollieSubscriptionId: replacement,
    pendingPlanId: null,
  });

  if (change.chargeNowInCents <= 0) {
    return {
      outcome: "gewijzigd",
      subscription: await store.updateSubscription(organisation.id, { planId }),
    };
  }

  const plan = getPlan(planId);
  const payment = await createPayment({
    amountInCents: priceBreakdown(change.chargeNowInCents).totalInCents,
    description: `${APP_NAME} — upgrade naar ${plan.name}`,
    customerId: subscription.mollieCustomerId!,
    // Geen betaalscherm: dit loopt op het mandaat dat er al is.
    sequenceType: "recurring",
    metadata: {
      organisationId: organisation.id,
      planId,
      purpose: "upgrade",
    },
    // Twee keer op de knop duwen mag geen twee incasso's opleveren.
    idempotencyKey: `upgrade-${organisation.id}-${planId}-${subscription.currentPeriodEnd}`,
  });

  return { outcome: "betaling-gestart", paymentId: payment.id };
}

/**
 * Het abonnement bij Mollie vervangen door een met een ander bedrag.
 *
 * Mollie laat het bedrag van een lopend abonnement wel wijzigen, maar niet in
 * combinatie met een startdatum in de toekomst. Opzeggen en opnieuw aanmaken is
 * daarom niet omslachtiger maar juist explicieter: er is één moment waarop het
 * oude bedrag stopt en het nieuwe begint, en dat moment staat in de code.
 */
async function replaceMollieSubscription(input: {
  subscription: Subscription;
  planId: PlanId;
  startDate: string;
}): Promise<string | null> {
  const { subscription } = input;
  if (!subscription.mollieCustomerId || !subscription.mollieMandateId) return null;

  if (subscription.mollieSubscriptionId) {
    await cancelMollieSubscription(
      subscription.mollieCustomerId,
      subscription.mollieSubscriptionId,
    ).catch(() => {
      // Al opgezegd of niet meer gevonden: dan is het doel al bereikt.
    });
  }

  const plan = getPlan(input.planId);
  const created = await createSubscription({
    customerId: subscription.mollieCustomerId,
    amountInCents: grossPriceInCents(plan.pricePerMonthInCents),
    description: `${APP_NAME} ${plan.name} — maandabonnement`,
    mandateId: subscription.mollieMandateId,
    startDate: toMollieDate(input.startDate),
    metadata: { organisationId: subscription.organisationId, planId: input.planId },
  });

  return created.id;
}

/* -------------------------------------------------------------------------
 * Opzeggen en hervatten
 * ---------------------------------------------------------------------- */

/**
 * Opzeggen tegen het einde van de betaalde periode.
 *
 * Het abonnement bij Mollie gaat meteen weg — dat is wat "er wordt niets meer
 * afgeschreven" betekent — maar de dienst loopt door tot de dag waarvoor
 * betaald is. Er wordt niets terugbetaald en dat staat ook zo op het scherm.
 */
export async function cancelAtPeriodEnd(organisation: Organisation): Promise<Subscription> {
  const store = getBillingStore();
  const subscription = await loadSubscription(organisation.id);

  if (subscription.mollieCustomerId && subscription.mollieSubscriptionId) {
    await cancelMollieSubscription(
      subscription.mollieCustomerId,
      subscription.mollieSubscriptionId,
    ).catch(() => {
      // Bestond al niet meer; het resultaat is hetzelfde.
    });
  }

  // De proefperiode heeft geen betaalde periode om uit te lopen.
  if (subscription.status === "proef") {
    return store.updateSubscription(organisation.id, {
      status: "opgezegd",
      cancelAtPeriodEnd: true,
      mollieSubscriptionId: null,
      pendingPlanId: null,
    });
  }

  return store.updateSubscription(organisation.id, {
    cancelAtPeriodEnd: true,
    mollieSubscriptionId: null,
    pendingPlanId: null,
  });
}

/** De opzegging terugdraaien, zolang de periode nog loopt. */
export async function resumeSubscription(organisation: Organisation): Promise<Subscription> {
  const store = getBillingStore();
  const subscription = await loadSubscription(organisation.id);

  const mollieSubscriptionId = await replaceMollieSubscription({
    subscription,
    planId: subscription.planId,
    startDate: subscription.currentPeriodEnd,
  });

  return store.updateSubscription(organisation.id, {
    cancelAtPeriodEnd: false,
    status: "actief",
    mollieSubscriptionId,
  });
}

/* -------------------------------------------------------------------------
 * Uit de betaling afleiden
 * ---------------------------------------------------------------------- */

/**
 * Bij welke organisatie hoort deze betaling?
 *
 * Drie wegen, in volgorde van betrouwbaarheid. De metadata is het duidelijkst
 * — die hebben we er zelf in gezet — maar een incasso die Mollie zelf op een
 * abonnement doet, draagt onze metadata niet altijd mee. Dan blijven de ids
 * van het abonnement en de klant over.
 */
async function resolveOrganisationId(payment: MolliePayment): Promise<ID | null> {
  const store = getBillingStore();
  const fromMetadata = payment.metadata?.organisationId;

  if (fromMetadata) return fromMetadata;

  if (payment.subscriptionId) {
    const match = await store.findByMollieSubscriptionId(payment.subscriptionId);
    if (match) return match.organisationId;
  }

  if (payment.customerId) {
    const match = await store.findByMollieCustomerId(payment.customerId);
    if (match) return match.organisationId;
  }

  return null;
}

function resolvePurpose(payment: MolliePayment): PaymentPurpose {
  const fromMetadata = payment.metadata?.purpose;

  if (
    fromMetadata === "start" ||
    fromMetadata === "upgrade" ||
    fromMetadata === "verlenging" ||
    fromMetadata === "herkansing"
  ) {
    return fromMetadata;
  }

  // Mollie int zelf op een abonnement: dat is per definitie een verlenging.
  return payment.subscriptionId ? "verlenging" : "start";
}

function resolvePlanId(payment: MolliePayment, subscription: Subscription): PlanId {
  const fromMetadata = payment.metadata?.planId;

  if (fromMetadata === "starter" || fromMetadata === "kantoor" || fromMetadata === "groep") {
    return fromMetadata;
  }

  return subscription.planId;
}

/**
 * Het bedrag exclusief btw, teruggerekend uit wat er geïnd is.
 *
 * Het bruto bedrag is de waarheid — dat is wat er van de rekening ging — dus de
 * btw wordt eruit gehaald en niet erbij opgeteld. Anders zou een afronding van
 * een halve cent het overzicht een cent laten verschillen van de afschrift.
 */
function subtotalOf(payment: MolliePayment): number {
  const [whole = "0", fraction = "0"] = payment.amount.value.split(".");
  const gross =
    Math.abs(Number.parseInt(whole, 10)) * 100 + Number.parseInt(fraction.padEnd(2, "0"), 10);

  return Math.round(gross / (1 + VAT_RATE));
}

/** Definitief mislukt? `open` en `pending` zijn dat niet: die zijn nog onderweg. */
function isFinalFailure(payment: MolliePayment): boolean {
  return payment.status === "failed" || payment.status === "expired" || payment.status === "canceled";
}
