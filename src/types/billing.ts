import type { ID, Timestamps } from "@/types/common";

export type PlanId = "starter" | "kantoor" | "groep";

export type Plan = {
  id: PlanId;
  name: string;
  description: string;
  /**
   * Exclusief btw. Een makelaarskantoor is een onderneming en rekent de btw
   * terug; de prijs die telt is dus de prijs zonder. Wat er effectief geïnd
   * wordt staat in `grossPriceInCents()` — daar komt 21 % bij.
   */
  pricePerMonthInCents: number;
  includedRendersPerMonth: number;
  features: string[];
};

/**
 * De betaalmethodes die we aanbieden.
 *
 * Twee, en in deze volgorde. Bancontact is in België wat iDEAL in Nederland is:
 * zes op de tien online betalingen. Een kaart erbij voor wie geen Belgische
 * rekening heeft, en daarmee is het af — meer keuze op een betaalscherm maakt
 * het niet vertrouwder, alleen langer.
 */
export type PaymentMethodId = "bancontact" | "creditcard";

/**
 * De toestand van een abonnement, zoals de app hem kent.
 *
 * Dit is niet de status van Mollie. Mollie kent de status van een *betaling* en
 * van een *abonnement*; dit is wat dat samen betekent voor het kantoor, en dat
 * is wat er op het scherm hoort te staan.
 */
export type SubscriptionStatus =
  /** Proefperiode: alles werkt, er is nog niet betaald. */
  | "proef"
  /** Een betaling loopt; we wachten op Mollie. */
  | "wachtend"
  | "actief"
  /** Een incasso is mislukt. De dienst loopt door, maar niet lang meer. */
  | "achterstallig"
  /** Opgezegd én de periode is voorbij. Tot die tijd blijft de status "actief". */
  | "opgezegd";

export type Subscription = {
  id: ID;
  organisationId: ID;
  planId: PlanId;
  status: SubscriptionStatus;
  /** Begin van de lopende periode; nodig om een upgrade pro rata te rekenen. */
  currentPeriodStart: string;
  /** Waar de lopende periode eindigt; ook het moment van de volgende incasso. */
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  /** Alleen bij status `proef`. */
  trialEndsAt?: string | null;
  /**
   * Een gekozen kleiner plan dat pas ingaat als de betaalde periode om is.
   * `null` zolang er niets gepland staat. Zie `lib/billing/changes.ts`.
   */
  pendingPlanId?: PlanId | null;
  /** Met welke methode het mandaat is afgegeven; bepaalt hoe er geïnd wordt. */
  paymentMethod?: PaymentMethodId | null;
  /** De klant bij Mollie. Blijft bestaan, ook na opzeggen. */
  mollieCustomerId?: string | null;
  /** Het lopende abonnement bij Mollie; `null` zodra het opgezegd is. */
  mollieSubscriptionId?: string | null;
  /** Het mandaat waarop geïnd wordt. Zonder dit is er geen automatische afname. */
  mollieMandateId?: string | null;
} & Timestamps;

/**
 * Waar een betaling voor diende. Bepaalt wat er ná het slagen ervan moet
 * gebeuren, en dat is wat de webhook nodig heeft.
 */
export type PaymentPurpose =
  /** Eerste betaling: maakt het mandaat en start het abonnement. */
  | "start"
  /** Het verschil bij een upgrade midden in een periode. */
  | "upgrade"
  /** Maandelijkse incasso door Mollie. */
  | "verlenging"
  /** Nieuwe poging na een mislukte incasso. */
  | "herkansing";

export type InvoiceStatus = "betaald" | "open" | "mislukt" | "terugbetaald";

/**
 * Eén regel in de betaalgeschiedenis.
 *
 * Bij elke betaling hoort er precies één, of die nu gelukt is of niet — een
 * mislukte incasso weglaten zou de belangrijkste regel van het overzicht
 * verbergen.
 */
export type Invoice = {
  id: ID;
  organisationId: ID;
  /** Doorlopend, per organisatie: `2026-0007`. */
  number: string;
  status: InvoiceStatus;
  purpose: PaymentPurpose;
  planId: PlanId;
  description: string;
  /** Exclusief btw. */
  subtotalInCents: number;
  vatInCents: number;
  /** Wat er effectief geïnd is of wordt. */
  amountInCents: number;
  currency: string;
  method?: PaymentMethodId | null;
  /** De periode die met deze betaling gedekt is. */
  periodStart?: string | null;
  periodEnd?: string | null;
  paidAt?: string | null;
  /** Alleen bij status `mislukt`: wat Mollie erover zegt, in leesbare vorm. */
  failureReason?: string | null;
  /** De betaling bij Mollie; ook de sleutel waarmee de webhook deze regel vindt. */
  molliePaymentId?: string | null;
  pdfUrl?: string | null;
} & Timestamps;

/**
 * Een afrekening die nog loopt.
 *
 * Wordt aangemaakt op het moment dat de klant naar Mollie vertrekt en is de
 * enige manier waarop de terugkeerpagina weet waar hij naar kijkt. Hij bestaat
 * ook omdat de webhook sneller kan zijn dan de terugkeer, en soms trager — met
 * een eigen rij is dat verschil niet meer merkbaar.
 */
export type CheckoutAttemptStatus = "open" | "geslaagd" | "mislukt";

export type CheckoutAttempt = {
  id: ID;
  organisationId: ID;
  molliePaymentId: string;
  planId: PlanId;
  purpose: PaymentPurpose;
  method: PaymentMethodId;
  amountInCents: number;
  status: CheckoutAttemptStatus;
  /** Waar de klant het betaalscherm vindt; alleen zinvol zolang de status `open` is. */
  checkoutUrl?: string | null;
  /** Ingevuld zodra de betaling mislukt is. */
  failureReason?: string | null;
} & Timestamps;
