import { toMollieAmount } from "@/lib/mollie/amount";
import { mollieRequest } from "@/lib/mollie/client";
import { mollieLocale, mollieProfileId, returnUrl, webhookUrl } from "@/lib/mollie/config";
import type {
  MollieCustomer,
  MollieList,
  MollieMandate,
  MollieMethod,
  MolliePayment,
  MollieSubscription,
} from "@/lib/mollie/types";

/**
 * De aanroepen die deze app bij Mollie doet.
 *
 * Vijf endpoints, meer niet. De volgorde hieronder is die van een klantleven:
 * eerst wordt hij klant, dan doet hij één betaling die een mandaat oplevert, en
 * op dat mandaat loopt daarna elke maand een abonnement.
 *
 * Twee dingen zitten hier ingebakken omdat ze anders per aanroep vergeten
 * kunnen worden: de `webhookUrl` (zonder dat hoort niemand ooit dat er betaald
 * is) en de `locale` (zonder dat gokt Mollie de taal op het IP-adres).
 */

/* -------------------------------------------------------------------------
 * Klant
 * ---------------------------------------------------------------------- */

export type CreateCustomerInput = {
  name: string;
  email: string;
  /** Wij zetten hier het organisatie-id in, zodat een klant in het Mollie-dashboard terug te vinden is. */
  metadata?: Record<string, string>;
};

export async function createCustomer(input: CreateCustomerInput): Promise<MollieCustomer> {
  return mollieRequest<MollieCustomer>("POST", "/customers", {
    name: input.name,
    email: input.email,
    locale: mollieLocale(),
    metadata: input.metadata,
  });
}

export async function getCustomer(customerId: string): Promise<MollieCustomer> {
  return mollieRequest<MollieCustomer>("GET", `/customers/${customerId}`);
}

/* -------------------------------------------------------------------------
 * Betaling
 * ---------------------------------------------------------------------- */

export type CreatePaymentInput = {
  amountInCents: number;
  description: string;
  customerId: string;
  /**
   * `first` levert een mandaat op en stuurt de klant door een betaalscherm.
   * `recurring` int op een bestaand mandaat en heeft geen scherm nodig.
   */
  sequenceType: "first" | "recurring";
  /** Alleen bij `first`; bij `recurring` bepaalt het mandaat de methode. */
  method?: MollieMethod;
  metadata: Record<string, string>;
  /** Maakt de aanroep herhaalbaar; zie `mollieRequest`. */
  idempotencyKey?: string;
};

/**
 * Een betaling aanmaken.
 *
 * De `redirectUrl` kan pas gezet worden als de betaling een id heeft, en dat id
 * krijg je pas bij het aanmaken — een kip-en-eiprobleem dat Mollie oplost met
 * `{id}` niet te ondersteunen. Daarom staat er een tussenstap: we maken de
 * betaling met een terugkeer-URL zonder id en zetten die daarna bij. Dat is één
 * extra aanroep, maar het levert een terugkeerpagina op die meteen weet over
 * welke betaling het gaat, in plaats van te moeten raden uit de sessie.
 */
export async function createPayment(input: CreatePaymentInput): Promise<MolliePayment> {
  const hook = webhookUrl();

  const payment = await mollieRequest<MolliePayment>(
    "POST",
    "/payments",
    {
      amount: toMollieAmount(input.amountInCents),
      description: input.description,
      customerId: input.customerId,
      sequenceType: input.sequenceType,
      // Bij een incasso op een bestaand mandaat is er niets te kiezen.
      ...(input.sequenceType === "first" && input.method ? { method: input.method } : {}),
      ...(input.sequenceType === "first"
        ? { redirectUrl: returnUrl("pending"), locale: mollieLocale() }
        : {}),
      ...(hook ? { webhookUrl: hook } : {}),
      ...(mollieProfileId() ? { profileId: mollieProfileId() } : {}),
      metadata: input.metadata,
    },
    { idempotencyKey: input.idempotencyKey },
  );

  if (input.sequenceType !== "first") return payment;

  return mollieRequest<MolliePayment>("PATCH", `/payments/${payment.id}`, {
    redirectUrl: returnUrl(payment.id),
  });
}

/**
 * De betaling zoals Mollie hem kent.
 *
 * Dit is de kern van de webhookafhandeling: wat er binnenkomt is alleen een id,
 * en pas dit antwoord is te vertrouwen. Zie `app/api/billing/webhook/route.ts`.
 */
export async function getPayment(paymentId: string): Promise<MolliePayment> {
  return mollieRequest<MolliePayment>("GET", `/payments/${paymentId}`);
}

/** De URL van het betaalscherm; `null` bij een betaling die geen scherm heeft. */
export function checkoutUrl(payment: MolliePayment): string | null {
  return payment._links?.checkout?.href ?? null;
}

/* -------------------------------------------------------------------------
 * Mandaat
 * ---------------------------------------------------------------------- */

/**
 * Het geldige mandaat van deze klant, of `null`.
 *
 * Een klant kan er meerdere hebben — een oude kaart die verlopen is naast een
 * nieuwe Bancontact-domiciliëring. Alleen `valid` telt: op een `pending` of
 * `invalid` mandaat kan niet geïnd worden.
 */
export async function findValidMandate(customerId: string): Promise<MollieMandate | null> {
  const list = await mollieRequest<MollieList<MollieMandate>>(
    "GET",
    `/customers/${customerId}/mandates?limit=50`,
  );

  const mandates = list._embedded?.mandates ?? [];

  return mandates.find((mandate) => mandate.status === "valid") ?? null;
}

/* -------------------------------------------------------------------------
 * Abonnement
 * ---------------------------------------------------------------------- */

export type CreateSubscriptionInput = {
  customerId: string;
  amountInCents: number;
  description: string;
  mandateId?: string | null;
  /**
   * `YYYY-MM-DD`. De eerste incasso valt op deze dag; laat je hem weg, dan int
   * Mollie meteen — en dat is bij ons dubbelop, want de eerste maand is net
   * betaald in het betaalscherm.
   */
  startDate: string;
  metadata: Record<string, string>;
  idempotencyKey?: string;
};

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<MollieSubscription> {
  const hook = webhookUrl();

  return mollieRequest<MollieSubscription>(
    "POST",
    `/customers/${input.customerId}/subscriptions`,
    {
      amount: toMollieAmount(input.amountInCents),
      interval: "1 month",
      description: input.description,
      startDate: input.startDate,
      ...(input.mandateId ? { mandateId: input.mandateId } : {}),
      ...(hook ? { webhookUrl: hook } : {}),
      metadata: input.metadata,
    },
    { idempotencyKey: input.idempotencyKey },
  );
}

export async function getSubscription(
  customerId: string,
  subscriptionId: string,
): Promise<MollieSubscription> {
  return mollieRequest<MollieSubscription>(
    "GET",
    `/customers/${customerId}/subscriptions/${subscriptionId}`,
  );
}

/**
 * Het abonnement opzeggen. Mollie int daarna niets meer; de lopende periode is
 * al betaald en loopt gewoon uit.
 */
export async function cancelSubscription(
  customerId: string,
  subscriptionId: string,
): Promise<MollieSubscription> {
  return mollieRequest<MollieSubscription>(
    "DELETE",
    `/customers/${customerId}/subscriptions/${subscriptionId}`,
  );
}
