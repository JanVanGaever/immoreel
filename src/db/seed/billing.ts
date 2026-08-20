import { SEED_ORGANISATION_ID, SEEDED_AT, days, seedTime } from "@/db/seed/config";
import { nextPeriod } from "@/lib/billing/changes";
import { describeInvoice, invoiceNumber } from "@/lib/billing/invoices";
import { getPlan, priceBreakdown } from "@/lib/billing/plans";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import type { Invoice, InvoiceStatus, PaymentPurpose, Subscription } from "@/types";

/**
 * Het abonnement van het demokantoor en de betaalgeschiedenis eronder.
 *
 * Acht regels over zeven maanden, en niet acht keer hetzelfde. Er zit één mislukte incasso in
 * met de herkansing die erop volgde, want dat is de rij waar de
 * betaalgeschiedenis om bestaat: een overzicht dat alleen geslaagde betalingen
 * toont, is geen overzicht maar een felicitatie. Het is ook het enige geval
 * waarin `/admin/billing` iets te filteren heeft.
 *
 * Alles staat relatief aan vandaag: de eerste factuur is zes maanden oud, de
 * lopende periode is deze maand. Zo veroudert het scherm niet zichtbaar zoals
 * vaste datums dat doen.
 */

const PLAN_ID = "kantoor" as const;

/** De maand waarin het abonnement nu loopt. */
function currentPeriod(): { start: string; end: string } {
  return nextPeriod(new Date(SEEDED_AT.getFullYear(), SEEDED_AT.getMonth(), 1));
}

export function seedSubscription(): Subscription {
  const period = currentPeriod();

  return {
    id: "sub_demo",
    organisationId: SEED_ORGANISATION_ID,
    planId: PLAN_ID,
    status: "actief",
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    pendingPlanId: null,
    paymentMethod: "bancontact",
    // Verzonnen ids in het formaat van Mollie: de webhook vindt er in
    // development een organisatie mee terug zonder dat er een account nodig is.
    mollieCustomerId: "cst_demo0janssens",
    mollieSubscriptionId: "sub_demo0janssens",
    mollieMandateId: "mdt_demo0janssens",
    createdAt: seedTime(-days(190)),
    updatedAt: period.start,
  };
}

type SeedInvoice = {
  /** Hoeveel maanden geleden er geïnd werd; 0 is deze maand. */
  monthsAgo: number;
  status: InvoiceStatus;
  purpose: PaymentPurpose;
  failureReason?: string;
  /** Dag in de maand; de herkansing komt een paar dagen na de mislukking. */
  dayOfMonth?: number;
};

/**
 * Zeven maanden abonnement: de start, vijf gewone incasso's, en in maand drie
 * een mislukking met de herkansing die vier dagen later wél lukte.
 */
const HISTORY: SeedInvoice[] = [
  { monthsAgo: 6, status: "betaald", purpose: "start" },
  { monthsAgo: 5, status: "betaald", purpose: "verlenging" },
  { monthsAgo: 4, status: "betaald", purpose: "verlenging" },
  {
    monthsAgo: 3,
    status: "mislukt",
    purpose: "verlenging",
    failureReason: "Onvoldoende saldo op de rekening.",
  },
  { monthsAgo: 3, status: "betaald", purpose: "herkansing", dayOfMonth: 5 },
  { monthsAgo: 2, status: "betaald", purpose: "verlenging" },
  { monthsAgo: 1, status: "betaald", purpose: "verlenging" },
  { monthsAgo: 0, status: "betaald", purpose: "verlenging" },
];

/**
 * Oudste eerst, want het factuurnummer loopt op met de tijd en niet met de
 * volgorde waarin dit bestand toevallig gelezen wordt. Een mislukte betaling
 * krijgt er ook een: zo doet `recordInvoice()` het ook, en het overzicht toont
 * die regel met haar reden erbij.
 */
export function seedInvoices(): Invoice[] {
  const plan = getPlan(PLAN_ID);
  const breakdown = priceBreakdown(plan.pricePerMonthInCents);
  const sequenceByYear = new Map<number, number>();

  return HISTORY.map((entry, index) => {
    const chargedAt = new Date(
      SEEDED_AT.getFullYear(),
      SEEDED_AT.getMonth() - entry.monthsAgo,
      entry.dayOfMonth ?? 1,
      6,
      12,
    );
    const year = chargedAt.getFullYear();
    const sequence = (sequenceByYear.get(year) ?? 0) + 1;
    sequenceByYear.set(year, sequence);

    const covered = nextPeriod(
      new Date(chargedAt.getFullYear(), chargedAt.getMonth(), 1),
    );
    const paid = entry.status === "betaald";

    return {
      id: `inv_demo${String(index + 1).padStart(2, "0")}`,
      organisationId: SEED_ORGANISATION_ID,
      number: invoiceNumber(year, sequence),
      status: entry.status,
      purpose: entry.purpose,
      planId: PLAN_ID,
      description: describeInvoice(entry.purpose, PLAN_ID),
      subtotalInCents: breakdown.subtotalInCents,
      vatInCents: breakdown.vatInCents,
      amountInCents: breakdown.totalInCents,
      currency: DEFAULT_CURRENCY,
      method: "bancontact",
      periodStart: covered.start,
      periodEnd: covered.end,
      paidAt: paid ? chargedAt.toISOString() : null,
      failureReason: entry.failureReason ?? null,
      molliePaymentId: `tr_demo${String(index + 1).padStart(2, "0")}`,
      // Er is nog geen pdf-generator; de knop op het overzicht weet daar raad mee.
      pdfUrl: null,
      createdAt: chargedAt.toISOString(),
      updatedAt: chargedAt.toISOString(),
    };
  });
}
