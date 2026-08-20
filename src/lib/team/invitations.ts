import type { BadgeVariant } from "@/components/ui/badge";
import type { Invitation, InvitationStatus } from "@/types";

/**
 * De regels rond een uitnodiging: hoe lang ze geldig is en waar ze staat.
 * Pure functies, zodat de teampagina, de serveractie en de store allemaal
 * hetzelfde antwoord geven.
 */

/**
 * Zeven dagen. Ruimer dan een herstellink (één uur) omdat een collega die
 * met vakantie is niet meteen klikt, maar niet eindeloos: een link die weken
 * blijft werken is een openstaande deur naar het kantoor.
 */
export const INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * `verlopen` staat nergens opgeslagen: het is de vervaldatum tegen de klok.
 * Zo hoeft er geen taak rond te lopen die rijen bijwerkt, en klopt de status
 * ook als er dagen niets gedraaid heeft.
 */
export function invitationStatus(
  invitation: Pick<Invitation, "acceptedAt" | "revokedAt" | "expiresAt">,
  now: number = Date.now(),
): InvitationStatus {
  if (invitation.acceptedAt) return "aanvaard";
  if (invitation.revokedAt) return "ingetrokken";
  if (new Date(invitation.expiresAt).getTime() <= now) return "verlopen";

  return "openstaand";
}

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  openstaand: "Uitgenodigd",
  aanvaard: "Aanvaard",
  ingetrokken: "Ingetrokken",
  verlopen: "Verlopen",
};

export const INVITATION_STATUS_VARIANTS: Record<InvitationStatus, BadgeVariant> = {
  openstaand: "warning",
  aanvaard: "success",
  ingetrokken: "neutral",
  verlopen: "danger",
};
