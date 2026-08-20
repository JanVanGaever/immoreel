import type { MollieMethod } from "@/lib/mollie/types";
import type { PaymentMethodId } from "@/types";

/**
 * De betaalmethodes, zoals ze op het scherm staan.
 *
 * Bancontact eerst, en niet omdat het alfabetisch zo uitkomt: het is in België
 * veruit de meest gebruikte manier om online te betalen, en een betaalscherm
 * dat daar níet mee begint voelt voor een Belgische klant meteen buitenlands.
 * De kaart staat eronder voor wie geen Belgische rekening heeft.
 *
 * Allebei leveren ze een mandaat op — dat is wat de maandelijkse afname
 * mogelijk maakt — maar op een andere manier, en dat verschil hoort de klant
 * te lezen vóór hij tekent. Bij Bancontact wordt het een SEPA-domiciliëring:
 * de afname loopt daarna van de rekening, niet meer via Bancontact.
 */

export type PaymentMethodOption = {
  id: PaymentMethodId;
  /** Zoals de klant de methode kent; merknamen dus, met hoofdletter. */
  label: string;
  description: string;
  /** Wat er ná de eerste betaling gebeurt. Staat klein onder de keuze. */
  recurringNote: string;
  /** De naam die Mollie voor deze methode gebruikt. */
  mollieMethod: MollieMethod;
  /** Of er op dit mandaat maandelijks geïnd kan worden. */
  supportsRecurring: boolean;
};

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "bancontact",
    label: "Bancontact",
    description: "Betaal met je bankkaart of de Payconiq-app.",
    recurringNote:
      "Je geeft meteen een SEPA-domiciliëring af. De maandelijkse afname loopt daarna van je rekening; je kan ze bij je bank altijd stopzetten.",
    mollieMethod: "bancontact",
    supportsRecurring: true,
  },
  {
    id: "creditcard",
    label: "Kredietkaart",
    description: "Visa, Mastercard of American Express.",
    recurringNote:
      "Je kaart wordt bewaard bij Mollie, niet bij ons. Elke maand wordt hetzelfde bedrag afgehouden tot je opzegt.",
    mollieMethod: "creditcard",
    supportsRecurring: true,
  },
];

export const DEFAULT_PAYMENT_METHOD: PaymentMethodId = "bancontact";

export function findPaymentMethod(id: PaymentMethodId | null | undefined): PaymentMethodOption {
  return PAYMENT_METHODS.find((method) => method.id === id) ?? PAYMENT_METHODS[0]!;
}

export function isPaymentMethodId(value: unknown): value is PaymentMethodId {
  return PAYMENT_METHODS.some((method) => method.id === value);
}

/**
 * De methode achter een betaling zoals Mollie hem teruggeeft.
 *
 * Mollie noemt de methode van een incasso `directdebit` en niet `bancontact`:
 * het mandaat is een SEPA-domiciliëring geworden, ook al is het via Bancontact
 * afgegeven. Voor de klant is dat dezelfde keuze, dus we noemen het ook zo.
 */
export function fromMollieMethod(method: string | null | undefined): PaymentMethodId | null {
  if (!method) return null;
  if (method === "creditcard") return "creditcard";
  if (method === "bancontact" || method === "directdebit") return "bancontact";

  return null;
}
