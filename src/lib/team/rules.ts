import { ROLE_LABELS, can } from "@/lib/auth/roles";
import type { ID, Role } from "@/types";

/**
 * Wie wat met wie mag doen binnen een kantoor.
 *
 * Alles hier is puur: dezelfde functies bepalen of een knop uitgeschakeld
 * staat én of de serveractie doorgaat. De reden komt mee als tekst, zodat de
 * uitleg op het scherm dezelfde is als in de foutmelding — één regel, één
 * zin, op één plek.
 *
 * De UI is nooit het slot. Elke serveractie in `actions.ts` draait deze
 * controles opnieuw, want een uitgeschakelde knop is een suggestie.
 */

export type TeamCheck = { allowed: boolean; reason?: string };

const ALLOWED: TeamCheck = { allowed: true };

function denied(reason: string): TeamCheck {
  return { allowed: false, reason };
}

/** De actor: wie de handeling uitvoert. */
export type TeamActor = {
  role: Role;
  membershipId: ID;
};

/** Het doelwit: over wie de handeling gaat. */
export type TeamTarget = {
  membershipId: ID;
  role: Role;
};

export function canManageTeam(role: Role): boolean {
  return can(role, "members:manage");
}

/**
 * Rol wijzigen.
 *
 * Twee dingen worden bewust geweigerd, ook aan een eigenaar:
 *
 * - **Je eigen rol.** Wie zichzelf verlaagt, sluit zichzelf buiten de pagina
 *   waarop hij staat. Een andere eigenaar doet dat, of niemand.
 * - **De laatste eigenaar verlagen.** Een kantoor zonder eigenaar kan niets
 *   meer: geen facturatie, geen team, geen organisatiegegevens. Dat is geen
 *   toestand waar de app zelf in mag belanden.
 */
export function checkRoleChange(
  actor: TeamActor,
  target: TeamTarget,
  nextRole: Role,
  ownerCount: number,
): TeamCheck {
  if (!canManageTeam(actor.role)) {
    return denied(`Alleen een ${ROLE_LABELS.owner.toLowerCase()} past rollen aan.`);
  }

  if (actor.membershipId === target.membershipId) {
    return denied(
      `Je kan je eigen rol niet aanpassen. Laat een andere ${ROLE_LABELS.owner.toLowerCase()} dat doen.`,
    );
  }

  if (nextRole === target.role) {
    return denied(`Deze collega is al ${ROLE_LABELS[nextRole].toLowerCase()}.`);
  }

  if (target.role === "owner" && nextRole !== "owner" && ownerCount <= 1) {
    return denied(
      `Dit is de laatste ${ROLE_LABELS.owner.toLowerCase()} van je kantoor. Maak eerst iemand anders ${ROLE_LABELS.owner.toLowerCase()}.`,
    );
  }

  return ALLOWED;
}

/**
 * Verwijderen. Dezelfde twee vangnetten: niet jezelf, en niet de laatste
 * eigenaar.
 */
export function checkRemoval(actor: TeamActor, target: TeamTarget, ownerCount: number): TeamCheck {
  if (!canManageTeam(actor.role)) {
    return denied(`Alleen een ${ROLE_LABELS.owner.toLowerCase()} verwijdert teamleden.`);
  }

  if (actor.membershipId === target.membershipId) {
    return denied(
      `Je kan jezelf niet verwijderen. Laat een andere ${ROLE_LABELS.owner.toLowerCase()} dat doen.`,
    );
  }

  if (target.role === "owner" && ownerCount <= 1) {
    return denied(`Dit is de laatste ${ROLE_LABELS.owner.toLowerCase()} van je kantoor.`);
  }

  return ALLOWED;
}

/**
 * Hoeveel plaatsen het abonnement heeft, en hoeveel er gebruikt zijn.
 * Een openstaande uitnodiging telt mee: ze wordt straks een gebruiker, en een
 * kantoor dat vijf mensen uitnodigt op vier plaatsen komt anders pas bij de
 * vierde aanvaarding tegen de muur.
 */
export type SeatUsage = {
  /** Aantal plaatsen in het plan. `0` betekent onbeperkt. */
  seats: number;
  members: number;
  pendingInvitations: number;
};

export function seatsInUse(usage: SeatUsage): number {
  return usage.members + usage.pendingInvitations;
}

export function seatsAreUnlimited(usage: SeatUsage): boolean {
  return usage.seats === 0;
}

export function hasSeatLeft(usage: SeatUsage): boolean {
  return seatsAreUnlimited(usage) || seatsInUse(usage) < usage.seats;
}

/** Uitnodigen: het recht, en daarna de plaats in het abonnement. */
export function checkInvite(actorRole: Role, usage: SeatUsage): TeamCheck {
  if (!canManageTeam(actorRole)) {
    return denied(`Alleen een ${ROLE_LABELS.owner.toLowerCase()} nodigt collega's uit.`);
  }

  if (!hasSeatLeft(usage)) {
    return denied(
      `Je plan heeft ${usage.seats} ${usage.seats === 1 ? "plaats" : "plaatsen"} en die zijn bezet. Kies een groter plan of maak een plaats vrij.`,
    );
  }

  return ALLOWED;
}

/** Aantal eigenaars in een lijst leden — de teller achter de vangnetten hierboven. */
export function countOwners(members: readonly { role: Role }[]): number {
  return members.filter((member) => member.role === "owner").length;
}
