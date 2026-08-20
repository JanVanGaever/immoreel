import { randomUUID } from "node:crypto";
import { isSeedEnabled, seedNotifications } from "@/db/seed";
import type { NotificationContent } from "@/lib/notifications/catalogue";
import type { ID, Notification } from "@/types";

/**
 * Meldingen achter één poort, zoals de auth-, brand- en renderjobstore.
 *
 * Twee dingen bepalen de vorm van deze store:
 *
 * **Dubbel schrijven mag.** Alles wat hierboven zit mag zonder nadenken
 * opnieuw draaien: een webhook die Mollie twee keer aflevert, een worker die
 * na een hapering terugkomt, de facturatieherinneringen die bij elke keer
 * opvragen opnieuw berekend worden. `create()` weigert stil een tweede rij met
 * dezelfde `dedupeKey` voor dezelfde gebruiker en geeft de bestaande terug.
 * Dat is dezelfde afspraak als bij de renderjobs: idempotent op een afgeleide
 * sleutel, niet op een slot.
 *
 * **Lezen is per gebruiker, niet per organisatie.** Een melding hoort bij één
 * persoon — de collega die de export vroeg, de eigenaar die de rekening
 * betaalt. Wie meeleest in dezelfde organisatie, ziet daarom niet automatisch
 * elkaars bel.
 *
 * De implementatie hieronder houdt alles in het geheugen van het proces. Dat
 * betekent — net als bij de renderjobs — dat een worker in een ander proces
 * hier niet in schrijft (zie `RENDER_WORKER_INLINE` in `src/workers/README.md`).
 * De toast van een afgewerkte render komt daar niet door in gevaar: die volgt
 * uit de eventstroom van de wachtrij en niet uit deze tabel. Wat er tot de ORM
 * ontbreekt, is de rij die er achteraf nog staat.
 */

/** Hoeveel meldingen we per gebruiker bijhouden. Ouder dan dit valt weg. */
export const NOTIFICATION_LIMIT = 50;

export type CreateNotificationInput = NotificationContent & {
  organisationId: ID;
  userId: ID;
};

export type NotificationStore = {
  /** Nieuwste eerst, hoogstens `NOTIFICATION_LIMIT`. */
  list(userId: ID): Promise<Notification[]>;
  countUnread(userId: ID): Promise<number>;
  /** Bestaat er al een melding met deze `dedupeKey`, dan komt die terug. */
  create(input: CreateNotificationInput): Promise<{ notification: Notification; created: boolean }>;
  /** Geeft terug hoeveel er effectief van ongelezen naar gelezen gingen. */
  markRead(userId: ID, notificationIds: readonly ID[]): Promise<number>;
  markAllRead(userId: ID): Promise<number>;
  /** Bij het verwijderen van een account: de meldingen gaan mee. */
  deleteForUser(userId: ID): Promise<void>;
};

declare global {
  var __immoreelNotifications: Map<ID, Notification[]> | undefined;
}

function getData(): Map<ID, Notification[]> {
  globalThis.__immoreelNotifications ??= seed();

  return globalThis.__immoreelNotifications;
}

/**
 * De bel van het demokantoor staat niet leeg (`src/db/seed/notifications.ts`):
 * twee ongelezen meldingen en een gelezen, gemaakt uit dezelfde renderjobs die
 * op de downloadpagina staan. Met `IMMOREEL_SEED=off` begin je bij nul.
 */
function seed(): Map<ID, Notification[]> {
  return isSeedEnabled() ? seedNotifications() : new Map();
}

const memoryStore: NotificationStore = {
  async list(userId) {
    return [...(getData().get(userId) ?? [])];
  },

  async countUnread(userId) {
    return (getData().get(userId) ?? []).filter((notification) => !notification.readAt).length;
  },

  async create(input) {
    const existing = getData().get(input.userId) ?? [];
    const duplicate = existing.find((notification) => notification.dedupeKey === input.dedupeKey);

    if (duplicate) return { notification: duplicate, created: false };

    const now = new Date().toISOString();
    const notification: Notification = {
      id: randomUUID(),
      organisationId: input.organisationId,
      userId: input.userId,
      topic: input.topic,
      tone: input.tone,
      title: input.title,
      body: input.body,
      href: input.href,
      actionLabel: input.actionLabel,
      dedupeKey: input.dedupeKey,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // Nieuwste vooraan; de lijst is ook de volgorde op het scherm.
    getData().set(input.userId, [notification, ...existing].slice(0, NOTIFICATION_LIMIT));

    return { notification, created: true };
  },

  async markRead(userId, notificationIds) {
    const wanted = new Set(notificationIds);
    const now = new Date().toISOString();
    let changed = 0;

    const next = (getData().get(userId) ?? []).map((notification) => {
      if (!wanted.has(notification.id) || notification.readAt) return notification;

      changed += 1;

      return { ...notification, readAt: now, updatedAt: now };
    });

    if (changed > 0) getData().set(userId, next);

    return changed;
  },

  async markAllRead(userId) {
    const all = getData().get(userId) ?? [];

    return this.markRead(
      userId,
      all.filter((notification) => !notification.readAt).map((notification) => notification.id),
    );
  },

  async deleteForUser(userId) {
    getData().delete(userId);
  },
};

export function getNotificationStore(): NotificationStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  return memoryStore;
}
