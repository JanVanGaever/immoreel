import type { BadgeVariant } from "@/components/ui/badge";
import { getPlan } from "@/lib/billing/plans";
import type { MolliePayment } from "@/lib/mollie/types";
import type { InvoiceStatus, PaymentPurpose, PlanId } from "@/types";

/**
 * De betaalgeschiedenis: hoe een betaling van Mollie een leesbare regel wordt.
 *
 * Ook mislukte betalingen krijgen een regel. Dat is het verschil tussen een
 * overzicht en een lijstje: wie zich afvraagt waarom zijn abonnement op
 * "betaling openstaand" staat, hoort dat hier te kunnen lezen, met de reden
 * erbij en niet in een foutcode.
 */

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  start: "Eerste betaling",
  upgrade: "Bijbetaling upgrade",
  verlenging: "Maandelijkse verlenging",
  herkansing: "Nieuwe poging",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  betaald: "Betaald",
  open: "In verwerking",
  mislukt: "Mislukt",
  terugbetaald: "Terugbetaald",
};

export const INVOICE_STATUS_VARIANTS: Record<InvoiceStatus, BadgeVariant> = {
  betaald: "success",
  open: "warning",
  mislukt: "danger",
  terugbetaald: "neutral",
};

/**
 * Van betaalstatus bij Mollie naar wat er in het overzicht staat.
 *
 * `authorized` telt hier als open en niet als betaald: bij een kaartbetaling
 * die apart vastgelegd wordt, staat het geld nog niet op onze rekening.
 * `pending` is de normale toestand van een SEPA-incasso, die dagen onderweg is.
 */
export function invoiceStatusFor(status: MolliePayment["status"]): InvoiceStatus {
  if (status === "paid") return "betaald";
  if (status === "open" || status === "pending" || status === "authorized") return "open";

  return "mislukt";
}

/**
 * Een doorlopend nummer per organisatie: `2026-0007`.
 *
 * Het jaartal vooraan omdat een boekhouder daarop sorteert, en de teller die
 * elk jaar opnieuw begint omdat dat is wat een Belgisch factuurboek doet.
 */
export function invoiceNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(4, "0")}`;
}

export function describeInvoice(purpose: PaymentPurpose, planId: PlanId): string {
  const plan = getPlan(planId);

  if (purpose === "upgrade") return `Upgrade naar ${plan.name}`;
  if (purpose === "start") return `${plan.name} — eerste maand`;
  if (purpose === "herkansing") return `${plan.name} — openstaande betaling`;

  return `${plan.name} — maandabonnement`;
}

/* -------------------------------------------------------------------------
 * Waarom een betaling mislukte
 * ---------------------------------------------------------------------- */

/**
 * Mollie geeft twee soorten codes terug: die van de kaartverwerker
 * (`insufficient_funds`) en die van SEPA (`AM04`). De klant heeft aan geen van
 * beide iets, maar wél aan het verschil tussen "je kaart is verlopen" en "er
 * stond te weinig op de rekening" — dat bepaalt wat hij moet doen.
 */
const FAILURE_MESSAGES: Record<string, string> = {
  // Kaart
  insufficient_funds: "Er stond te weinig op de kaart.",
  card_expired: "De kaart is verlopen.",
  invalid_cvv: "De veiligheidscode klopte niet.",
  card_declined: "De kaart is geweigerd door de bank.",
  refused_by_issuer: "De bank heeft de betaling geweigerd.",
  authentication_failed: "De bevestiging bij de bank is niet gelukt.",
  possible_fraud: "De bank hield de betaling tegen als mogelijk frauduleus.",
  // SEPA-domiciliëring
  AC01: "Het rekeningnummer klopt niet meer.",
  AC04: "De rekening is afgesloten.",
  AC06: "De rekening is geblokkeerd voor domiciliëringen.",
  AG01: "De bank staat geen domiciliëring toe op deze rekening.",
  AM04: "Er stond te weinig op de rekening.",
  MD01: "De domiciliëring is stopgezet bij de bank.",
  MD06: "De betaling is door de rekeninghouder teruggevorderd.",
  MS03: "De bank heeft de incasso geweigerd zonder reden op te geven.",
};

export function failureMessage(payment: MolliePayment): string | null {
  if (payment.status === "expired") {
    return "De betaling is verlopen; er is niets afgeschreven.";
  }
  if (payment.status === "canceled") {
    return "De betaling is afgebroken; er is niets afgeschreven.";
  }
  if (payment.status !== "failed") return null;

  const code = payment.details?.failureReason ?? null;
  const known = code ? FAILURE_MESSAGES[code] : undefined;

  return known ?? payment.details?.failureMessage ?? "De betaling is niet gelukt.";
}

/**
 * Wat de klant moet doen na een mislukte betaling. Bewust één zin en één
 * handeling: bij een betaalprobleem is een lijstje mogelijkheden het laatste
 * waar iemand op zit te wachten.
 */
export function failureAdvice(payment: MolliePayment): string {
  const code = payment.details?.failureReason ?? "";

  if (code === "card_expired" || code === "AC01" || code === "AC04") {
    return "Kies hieronder opnieuw een betaalmethode; je geeft dan een nieuwe machtiging af.";
  }
  if (code === "insufficient_funds" || code === "AM04") {
    return "Probeer het opnieuw zodra er genoeg op de rekening staat.";
  }

  return "Probeer het opnieuw, of kies een andere betaalmethode.";
}
