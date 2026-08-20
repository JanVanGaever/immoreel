/**
 * De stukken van de Mollie-API die wij gebruiken.
 *
 * Bewust met de hand geschreven en niet gegenereerd: dit is een fractie van wat
 * de API teruggeeft, en die fractie is precies de documentatie van wat deze
 * app van Mollie verwacht. Wat hier niet staat, gebruiken we niet.
 *
 * Bedragen zijn bij Mollie altijd strings met twee decimalen (`"49.00"`) en
 * nooit getallen — zie `amount.ts` voor de vertaling van en naar centen.
 */

export type MollieAmount = {
  currency: string;
  /** Twee decimalen, punt als scheidingsteken: `"148.59"`. */
  value: string;
};

/**
 * De betaalmethodes die wij aanbieden. Mollie kent er tientallen; dit zijn de
 * twee die een Belgisch kantoor herkent en die allebei een mandaat kunnen
 * opleveren voor de maandelijkse afname.
 */
export type MollieMethod = "bancontact" | "creditcard";

/**
 * Waar een betaling in de rij staat.
 *
 * - `first` — de eerste betaling, die meteen een mandaat aanmaakt. Dit is de
 *   enige die de klant zelf doorloopt.
 * - `recurring` — een afname op dat mandaat. Geen betaalscherm, geen klant.
 * - `oneoff` — een losse betaling zonder gevolgen.
 */
export type MollieSequenceType = "oneoff" | "first" | "recurring";

/**
 * De levensloop van een betaling.
 *
 * Alleen `paid` is geld op de rekening. `authorized` komt voor bij
 * kaartbetalingen die apart vastgelegd worden en telt hier niet als betaald;
 * `pending` is een betaling die onderweg is (SEPA-incasso doet er dagen over).
 * De rest — `canceled`, `expired`, `failed` — is even definitief als elkaar.
 */
export type MolliePaymentStatus =
  | "open"
  | "canceled"
  | "pending"
  | "authorized"
  | "expired"
  | "failed"
  | "paid";

export type MolliePayment = {
  resource: "payment";
  id: string;
  mode: "test" | "live";
  status: MolliePaymentStatus;
  amount: MollieAmount;
  description: string;
  method: string | null;
  sequenceType: MollieSequenceType;
  customerId?: string | null;
  mandateId?: string | null;
  subscriptionId?: string | null;
  createdAt: string;
  paidAt?: string | null;
  failedAt?: string | null;
  canceledAt?: string | null;
  expiredAt?: string | null;
  /**
   * Wat wij zelf meegaven bij het aanmaken. Mollie geeft het onaangeraakt
   * terug, en omdat we het bij de API ophalen en niet uit de webhook lezen, is
   * het te vertrouwen.
   */
  metadata?: Record<string, string> | null;
  /** Waarom een kaartbetaling geweigerd is; niet altijd aanwezig. */
  details?: {
    failureReason?: string | null;
    failureMessage?: string | null;
    cardLabel?: string | null;
    cardNumber?: string | null;
    consumerName?: string | null;
  } | null;
  _links?: {
    checkout?: { href: string; type: string } | null;
  } | null;
};

export type MollieCustomer = {
  resource: "customer";
  id: string;
  name?: string | null;
  email?: string | null;
  metadata?: Record<string, string> | null;
};

/**
 * De status van een abonnement bij Mollie.
 *
 * `suspended` is de belangrijkste om te kennen: dat is wat er gebeurt na een
 * paar mislukte incasso's. Mollie stopt dan met proberen en wacht op ons.
 */
export type MollieSubscriptionStatus =
  | "pending"
  | "active"
  | "canceled"
  | "suspended"
  | "completed";

export type MollieSubscription = {
  resource: "subscription";
  id: string;
  customerId: string;
  mode: "test" | "live";
  status: MollieSubscriptionStatus;
  amount: MollieAmount;
  /** `"1 month"`, `"12 months"`, ... */
  interval: string;
  description: string;
  mandateId?: string | null;
  startDate?: string | null;
  nextPaymentDate?: string | null;
  canceledAt?: string | null;
  metadata?: Record<string, string> | null;
};

export type MollieMandateStatus = "valid" | "pending" | "invalid";

export type MollieMandate = {
  resource: "mandate";
  id: string;
  status: MollieMandateStatus;
  method: string;
  details?: Record<string, unknown> | null;
  mandateReference?: string | null;
  signatureDate?: string | null;
  createdAt: string;
};

export type MollieList<T> = {
  count: number;
  _embedded: Record<string, T[]>;
};
