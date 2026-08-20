import { ROLE_LABELS } from "@/lib/auth/roles";
import type { Role, SubscriptionStatus } from "@/types";

/**
 * Wanneer je je eigen account mag verwijderen.
 *
 * Puur, en met dezelfde vorm als `lib/team/rules.ts`: de reden komt als tekst
 * terug, zodat het scherm en de serveractie hetzelfde zeggen. De knop staat
 * grijs mét uitleg in plaats van een foutmelding ná het klikken.
 *
 * Er wordt maar naar twee dingen gekeken, en allebei zijn het dingen die de
 * gebruiker zelf kan oplossen vóór hij vertrekt:
 *
 * 1. **Het kantoor mag niet zonder eigenaar achterblijven.** Ben je de laatste
 *    eigenaar en werken er nog collega's, dan maak je er eerst een ander
 *    eigenaar. Anders staat er een kantoor met mensen erin dat niemand meer
 *    kan beheren — geen facturatie, geen team, geen instellingen.
 * 2. **Er mag geen abonnement blijven lopen.** Ben je de laatste in het
 *    kantoor, dan verdwijnt het kantoor met jou mee. Een lopend mandaat bij
 *    Mollie verdwijnt daar niet mee: dat blijft innen. Eerst opzeggen dus.
 */

export type AccountCheck = { allowed: boolean; reason?: string };

const ALLOWED: AccountCheck = { allowed: true };

function denied(reason: string): AccountCheck {
  return { allowed: false, reason };
}

export type DeletionContext = {
  role: Role;
  /** Aantal collega's náást jou in dit kantoor. */
  otherMembers: number;
  /** Aantal eigenaars in dit kantoor, jezelf meegeteld. */
  owners: number;
  subscriptionStatus: SubscriptionStatus;
};

/** Vertrekt het kantoor mee? Alleen als jij de laatste bent. */
export function organisationLeavesWithYou(context: DeletionContext): boolean {
  return context.otherMembers === 0;
}

/**
 * Een abonnement dat nog geld kost. `proef` en `opgezegd` niet: daar staat
 * niets meer open. `wachtend` en `achterstallig` wél — er loopt een betaling
 * of er is er een mislukt, en dat hoort afgehandeld te zijn.
 */
export function subscriptionKeepsCharging(status: SubscriptionStatus): boolean {
  return status === "actief" || status === "wachtend" || status === "achterstallig";
}

export function checkAccountDeletion(context: DeletionContext): AccountCheck {
  if (context.role === "owner" && context.otherMembers > 0 && context.owners <= 1) {
    return denied(
      `Je bent de laatste ${ROLE_LABELS.owner.toLowerCase()} van een kantoor waar nog ${context.otherMembers} ${
        context.otherMembers === 1 ? "collega" : "collega's"
      } in werkt. Maak eerst iemand anders ${ROLE_LABELS.owner.toLowerCase()}.`,
    );
  }

  if (organisationLeavesWithYou(context) && subscriptionKeepsCharging(context.subscriptionStatus)) {
    return denied(
      "Er loopt nog een abonnement. Zeg het eerst op, anders blijft er geïnd worden op een kantoor dat niet meer bestaat.",
    );
  }

  return ALLOWED;
}

/**
 * Wat de gebruiker moet intypen om te bevestigen. Zijn eigen e-mailadres:
 * dat kent hij uit het hoofd, staat op het scherm, en is lang genoeg om niet
 * per ongeluk te gebeuren.
 */
export function deletionConfirmationMatches(expected: string, typed: string): boolean {
  return typed.trim().toLowerCase() === expected.trim().toLowerCase();
}
