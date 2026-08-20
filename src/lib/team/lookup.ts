import { getAuthStore } from "@/db/auth-store";
import { getTeamStore } from "@/db/team-store";
import { hashEmailToken } from "@/lib/auth/tokens";
import { invitationStatus } from "@/lib/team/invitations";
import type { Role } from "@/types";

/**
 * Het token uit de link opzoeken, voor de uitnodigingspagina.
 *
 * Bewust geen serveractie: dit hoort bij het renderen van één pagina en heeft
 * geen endpoint nodig waar iedereen tokens tegenaan kan gooien.
 *
 * Wat er teruggegeven wordt, is het minimum om de pagina te kunnen tekenen:
 * het kantoor, de rol en de naam van wie uitnodigde. Geen e-mailadressen, geen
 * ledenlijst — een uitnodigingslink kan doorgestuurd zijn.
 */
export type InvitationLookup =
  | { status: "onbruikbaar" }
  | {
      status: "openstaand" | "bestaat-al";
      organisationName: string;
      role: Role;
      invitedByName: string | null;
      expiresAt: string;
    };

export async function describeInvitation(token: string | undefined): Promise<InvitationLookup> {
  if (!token) return { status: "onbruikbaar" };

  const invitation = await getTeamStore().findInvitationByTokenHash(await hashEmailToken(token));
  if (!invitation || invitationStatus(invitation) !== "openstaand") {
    return { status: "onbruikbaar" };
  }

  const authStore = getAuthStore();
  const organisation = await authStore.findOrganisation(invitation.organisationId);
  if (!organisation) return { status: "onbruikbaar" };

  const inviter = await authStore.findUserById(invitation.invitedByUserId);

  // Eén kantoor per gebruiker: hoort dit adres al bij een ander kantoor, dan
  // zegt de pagina dat meteen in plaats van na het invullen van een
  // formulier. Een account zonder lidmaatschap (ooit verwijderd hier) mag wel
  // aanvaarden en krijgt zijn account terug.
  const existing = await authStore.findUserByEmail(invitation.email);
  const elders = existing ? await authStore.findMembershipByUser(existing.id) : null;

  return {
    status: elders ? "bestaat-al" : "openstaand",
    organisationName: organisation.name,
    role: invitation.role,
    invitedByName: inviter?.name ?? null,
    expiresAt: invitation.expiresAt,
  };
}
