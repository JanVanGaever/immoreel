import { getBillingStore } from "@/db/billing-store";
import { daysUntil } from "@/lib/dashboard";
import { notify } from "@/lib/notifications/service";
import type { ID, NotificationEvent, Subscription } from "@/types";

/**
 * Facturatieherinneringen: de meldingen die niet uit een gebeurtenis komen maar
 * uit een datum die nadert.
 *
 * **Waarom er geen taak rondloopt.** Een herinnering over een proefperiode die
 * over drie dagen afloopt, is een som — geen gebeurtenis. Zoiets kun je op twee
 * manieren aanpakken: elke nacht een taak die door alle abonnementen loopt, of
 * de som maken op het moment dat iemand kijkt. Het tweede is hier het juiste,
 * en om dezelfde reden als bij `InvitationStatus` (`verlopen` wordt afgeleid en
 * niet opgeslagen): wat je kunt uitrekenen, hoef je niet bij te houden, en een
 * taak die rijen bijwerkt is een taak die kan stilvallen zonder dat iemand het
 * merkt.
 *
 * Dat mag alleen omdat het rekenen idempotent is. `dedupeKey` bevat het aantal
 * resterende dagen (zie de catalogus), dus vijftig keer opvragen op dezelfde
 * dag geeft één melding, en de dag erna een nieuwe met een nieuw getal.
 *
 * Wat wél uit een gebeurtenis komt — een incasso die mislukt is, een betaling
 * die binnen is — loopt niet langs hier maar rechtstreeks via `notify()` in
 * `lib/billing/service.ts`. Dat is nieuws en geen som.
 */

/** Vanaf hoeveel dagen vóór het einde van de proefperiode we beginnen te herinneren. */
export const TRIAL_REMINDER_DAYS = 5;

/** Idem voor een abonnement dat opgezegd is en afloopt. */
export const CANCELLATION_REMINDER_DAYS = 7;

/**
 * De herinneringen die op dit moment gelden voor dit abonnement.
 *
 * Puur: geen store, geen klok behalve degene die je meegeeft. Daardoor is de
 * hele regel in één oogopslag te lezen en in één regel te testen.
 */
export function billingReminders(
  subscription: Subscription,
  now: Date = new Date(),
): NotificationEvent[] {
  const events: NotificationEvent[] = [];

  if (subscription.status === "proef") {
    const endsAt = subscription.trialEndsAt ?? subscription.currentPeriodEnd;
    const daysLeft = daysUntil(endsAt, now);

    if (daysLeft <= TRIAL_REMINDER_DAYS) {
      events.push({
        topic: "proef-loopt-af",
        organisationId: subscription.organisationId,
        endsAt,
        daysLeft,
      });
    }
  }

  // Een opgezegd abonnement dat nog loopt, staat op `actief` — opzeggen is geen
  // aparte status (zie `lib/billing/status.ts`). De vlag is dus het enige waar
  // je dit aan ziet.
  if (subscription.cancelAtPeriodEnd && subscription.status !== "opgezegd") {
    const daysLeft = daysUntil(subscription.currentPeriodEnd, now);

    if (daysLeft <= CANCELLATION_REMINDER_DAYS) {
      events.push({
        topic: "abonnement-loopt-af",
        organisationId: subscription.organisationId,
        endsAt: subscription.currentPeriodEnd,
        daysLeft,
      });
    }
  }

  return events;
}

/**
 * De herinneringen van dit kantoor uitrekenen en bezorgen.
 *
 * Wordt aangeroepen wanneer de bel zijn lijst ophaalt. Dat is goedkoop (één
 * abonnement lezen) en het is het enige moment waarop het ertoe doet: een
 * herinnering die niemand ophaalt, hoeft ook niet te bestaan.
 */
export async function syncBillingReminders(organisationId: ID, now: Date = new Date()): Promise<void> {
  const subscription = await getBillingStore().getSubscription(organisationId);

  for (const event of billingReminders(subscription, now)) {
    await notify(event);
  }
}
