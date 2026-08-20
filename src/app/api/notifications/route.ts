import { getNotificationStore } from "@/db/notification-store";
import { handle, jsonOk, requireApiSession } from "@/lib/api";
import { syncBillingReminders } from "@/lib/notifications";
import type { NotificationFeed } from "@/types";

/**
 * De bel: alle meldingen van de ingelogde gebruiker, nieuwste eerst.
 *
 * `project:view` is genoeg — dit is het laagste recht dat er is, en meldingen
 * zijn van de gebruiker zelf en niet van zijn rol. Wat hij te zien krijgt, is
 * bepaald toen de melding gemaakt werd (`lib/notifications/recipients.ts`).
 *
 * De facturatieherinneringen worden hier uitgerekend en niet door een taak die
 * 's nachts loopt. Dat is goedkoop — één abonnement lezen — en idempotent, dus
 * pollen kost niets extra. De redenering staat in
 * `lib/notifications/billing-reminders.ts`.
 */
export async function GET() {
  return handle(async () => {
    const session = await requireApiSession("project:view");

    await syncBillingReminders(session.organisation.id);

    const store = getNotificationStore();
    const notifications = await store.list(session.user.id);

    const feed: NotificationFeed = {
      notifications,
      unread: notifications.filter((notification) => !notification.readAt).length,
    };

    return jsonOk(feed);
  });
}
