import { getAuthStore } from "@/db/auth-store";
import { can } from "@/lib/auth/roles";
import type { ID, NotificationEvent, PersonalNotificationTopic } from "@/types";

/**
 * Wie krijgt deze melding?
 *
 * Twee soorten, en het onderscheid is de moeite waard:
 *
 * - **Persoonlijk.** Een render is van wie hem gevraagd heeft. Het hele kantoor
 *   een belletje geven omdat een collega een export startte, is precies hoe een
 *   bel iets wordt wat mensen wegklikken zonder te lezen.
 * - **Voor het kantoor.** Facturatie gaat niemand persoonlijk aan maar wel
 *   iedereen die er iets aan kan doen. Dat zijn de mensen met
 *   `billing:manage` — vandaag de eigenaars, morgen wat de rollentabel zegt.
 *   Zo blijft er één plek waar staat wie over de rekening gaat.
 */
export async function resolveRecipients(event: NotificationEvent): Promise<ID[]> {
  if (isPersonal(event)) return [event.userId];

  return findBillingManagers(event.organisationId);
}

/**
 * De collega's die de facturatie beheren.
 *
 * Levert bewust een lege lijst op als er niemand gevonden wordt in plaats van
 * terug te vallen op "dan maar iedereen": een rekening die bij de verkeerde
 * persoon belandt, is erger dan een melding die niemand krijgt — en een
 * organisatie zonder eigenaar is een fout die in de logs hoort, niet in de bel
 * van een kijker.
 */
export async function findBillingManagers(organisationId: ID): Promise<ID[]> {
  const memberships = await getAuthStore().listMemberships(organisationId);

  return memberships
    .filter((membership) => can(membership.role, "billing:manage"))
    .map((membership) => membership.userId);
}

/**
 * Hoort deze gebeurtenis bij één persoon?
 *
 * Het type zegt het al — `userId` staat alleen op de persoonlijke onderwerpen —
 * maar TypeScript versmalt een doorsnede van unies niet vanzelf op een veld dat
 * bij de andere helft `never` is. Vandaar deze ene regel.
 */
function isPersonal(
  event: NotificationEvent,
): event is Extract<NotificationEvent, { topic: PersonalNotificationTopic }> {
  return event.topic === "render-klaar" || event.topic === "render-mislukt";
}
