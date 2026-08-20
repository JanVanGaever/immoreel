import { getAccountStore } from "@/db/account-store";
import { getAuthStore } from "@/db/auth-store";
import { getNotificationStore } from "@/db/notification-store";
import { createLogger } from "@/lib/errors/logger";
import { describeEvent, preferenceFor } from "@/lib/notifications/catalogue";
import type { NotificationContent } from "@/lib/notifications/catalogue";
import { isEmailChannelEnabled, sendNotificationEmail } from "@/lib/notifications/email";
import { resolveRecipients } from "@/lib/notifications/recipients";
import type { ID, Notification, NotificationChannel, NotificationEvent } from "@/types";

/**
 * `notify()`: het enige wat de rest van de app hoeft aan te roepen.
 *
 * De weg die een gebeurtenis aflegt:
 *
 *   gebeurtenis → ontvangers → tekst (catalogus) → kanalen → weg ermee
 *
 * Drie regels die daarbij horen, en die de reden zijn dat dit een aparte laag
 * is in plaats van een `store.create()` op de plek waar het gebeurt:
 *
 * 1. **In-app staat altijd aan.** De voorkeuren op de accountpagina gaan over
 *    wat wij *sturen*, niet over wat wij *tonen*. Een gebruiker die geen mail
 *    wil over mislukte renders, wil daarom nog niet dat zijn mislukte render
 *    nergens meer staat.
 * 2. **E-mail is per onderwerp.** De catalogus zegt welke schakelaar erover
 *    gaat; staat die uit, dan vertrekt er niets. Zonder provider vertrekt er
 *    sowieso niets (zie `email.ts`).
 * 3. **Melden mag nooit stukmaken wat het meldt.** Een render die klaar is,
 *    blijft klaar, ook als de mailserver eruit ligt of de store niet antwoordt.
 *    Alle fouten hieronder eindigen dus in een logregel en niet bij de
 *    aanroeper.
 */

const log = createLogger("notifications");

export type NotifyResult = {
  /** De rijen die er effectief bij gekomen zijn; dubbels zitten er niet in. */
  created: Notification[];
  /** Waar het naartoe ging; voor de logregel en voor de tests. */
  channels: NotificationChannel[];
};

export async function notify(event: NotificationEvent): Promise<NotifyResult> {
  try {
    return await deliver(event);
  } catch (error) {
    log.error("melding kon niet bezorgd worden", error, { topic: event.topic });

    return { created: [], channels: [] };
  }
}

async function deliver(event: NotificationEvent): Promise<NotifyResult> {
  const content = describeEvent(event);
  const recipients = await resolveRecipients(event);

  if (recipients.length === 0) {
    log.warn("melding zonder ontvangers", {
      topic: event.topic,
      organisationId: event.organisationId,
    });

    return { created: [], channels: [] };
  }

  const store = getNotificationStore();
  const created: Notification[] = [];
  const channels = new Set<NotificationChannel>();

  for (const userId of recipients) {
    const { notification, created: isNew } = await store.create({
      ...content,
      organisationId: event.organisationId,
      userId,
    });

    channels.add("in-app");

    // Alleen bij een nieuwe rij. Anders mailt een webhook die drie keer
    // aankomt, drie keer hetzelfde — precies wat `dedupeKey` moet voorkomen.
    if (!isNew) continue;

    created.push(notification);

    if (await mail(userId, content)) channels.add("email");
  }

  log.info("melding bezorgd", {
    topic: event.topic,
    recipients: recipients.length,
    created: created.length,
    channels: [...channels].join(","),
  });

  return { created, channels: [...channels] };
}

/** De e-mailkant: eerst de voorkeur van de gebruiker, dan pas het adres. */
async function mail(userId: ID, content: NotificationContent): Promise<boolean> {
  if (!isEmailChannelEnabled()) return false;

  const preferences = await getAccountStore().getPreferences(userId);
  if (!preferences.notifications[preferenceFor(content.topic)]) return false;

  const user = await getAuthStore().findUserById(userId);
  if (!user) return false;

  return sendNotificationEmail({ to: user.email, content });
}
