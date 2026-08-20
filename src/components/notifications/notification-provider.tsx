"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/toast";
import { API_ROUTES } from "@/lib/constants";
import { createLogger } from "@/lib/errors/logger";
import { requestJson } from "@/lib/errors/request";
import { shouldToast } from "@/lib/notifications/catalogue";
import type { ID, Notification, NotificationFeed, ToastInput } from "@/types";

/**
 * De meldingen van de ingelogde gebruiker, voor het hele scherm.
 *
 * Twee dingen die deze provider oplost en die je in de losse onderdelen niet
 * kunt oplossen:
 *
 * **Eén bron voor de bel.** De teller in de topbar en de lijst in het menu zijn
 * hetzelfde gegeven. Twee keer ophalen zou betekenen dat het bolletje en de
 * lijst het over een verschillend aantal kunnen hebben.
 *
 * **Eén keer toasten.** Een afgewerkte render komt via twee wegen binnen: de
 * eventstroom van de downloadpagina (meteen) en deze lijst (bij de volgende
 * ronde). Dat is geen fout maar het vangnet — wie de downloadpagina niet
 * openstaan heeft, hoort het alsnog te zien. Het mag alleen niet twee blokjes
 * opleveren. Vandaar `toastOnce()`: dezelfde sleutel toast één keer per sessie,
 * en beide wegen gebruiken de `dedupeKey` van de melding als sleutel.
 *
 * Er is bewust geen eventstroom voor de bel. Meldingen zijn zeldzaam en niet
 * dringend; een verbinding per open tabblad openhouden voor iets wat een paar
 * keer per dag gebeurt, is duurder dan het waard is. De rendervoortgang — die
 * wel elke seconde beweegt — heeft zijn eigen stroom (`useRenderJobs`).
 */

/** Hoe vaak we de lijst opnieuw ophalen zolang het tabblad zichtbaar is. */
const POLL_INTERVAL_MS = 60_000;

const log = createLogger("notifications");

const EMPTY_FEED: NotificationFeed = { notifications: [], unread: 0 };

export type NotificationContextValue = {
  notifications: Notification[];
  unread: number;
  /** Alleen waar tijdens de allereerste ronde; daarna ververst hij stil. */
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (ids: readonly ID[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  /**
   * Een toast tonen die hoogstens één keer per sessie verschijnt, hoe vaak
   * dezelfde gebeurtenis ook binnenkomt. De sleutel is de `dedupeKey` van de
   * melding.
   */
  toastOnce: (key: string, toast: ToastInput) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications() heeft een <NotificationProvider> boven zich nodig.");
  }

  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [feed, setFeed] = useState<NotificationFeed>(EMPTY_FEED);
  const [loading, setLoading] = useState(true);

  /** Waarvoor al een toast getoond is. Leeft zolang het tabblad openstaat. */
  const toasted = useRef<Set<string>>(new Set());
  /** De eerste ronde toast niet: dat is de achterstand, geen nieuws. */
  const primed = useRef(false);

  const toastOnce = useCallback(
    (key: string, input: ToastInput) => {
      if (toasted.current.has(key)) return;

      toasted.current.add(key);
      toast({ ...input, id: input.id ?? key });
    },
    [toast],
  );

  const refresh = useCallback(async () => {
    try {
      const next = await requestJson<NotificationFeed>(API_ROUTES.notifications);

      setFeed(next);

      // Bij het openen van de app staat er van alles klaar dat gisteren gebeurd
      // is. Dat hoort in de bel en niet in vier blokjes over je scherm; de
      // eerste ronde vult daarom alleen de lijst.
      for (const notification of next.notifications) {
        if (!primed.current) {
          toasted.current.add(notification.dedupeKey);
          continue;
        }

        if (notification.readAt || !shouldToast(notification.topic)) continue;

        toastOnce(notification.dedupeKey, toastFor(notification));
      }

      primed.current = true;
    } catch (error) {
      // Een mislukte ronde is geen nieuws voor de gebruiker: de vorige lijst
      // blijft staan en over een minuut proberen we opnieuw. Een rode balk voor
      // een bel die even niet ververst, is erger dan de bel zelf.
      log.warn("meldingen ophalen mislukt", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }, [toastOnce]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;

      await refresh();
    }

    void tick();

    const timer = setInterval(() => {
      // Een tabblad op de achtergrond hoeft niet mee te tellen; bij het
      // terugkomen wordt er sowieso ververst.
      if (document.visibilityState === "visible") void tick();
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const send = useCallback(async (body: { ids?: ID[]; all?: boolean }) => {
    await requestJson<{ unread: number }>(API_ROUTES.notificationsRead, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }, []);

  const markRead = useCallback(
    async (ids: readonly ID[]) => {
      if (ids.length === 0) return;

      const wanted = new Set(ids);
      const now = new Date().toISOString();

      // Eerst op het scherm, dan pas op de server: een bolletje dat pas
      // verdwijnt als het netwerk klaar is, voelt stuk.
      setFeed((current) => apply(current, (item) => (wanted.has(item.id) ? read(item, now) : item)));

      try {
        await send({ ids: [...ids] });
      } catch (error) {
        log.warn("markeren als gelezen mislukt", { error: String(error) });
        void refresh();
      }
    },
    [refresh, send],
  );

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();

    setFeed((current) => apply(current, (item) => read(item, now)));

    try {
      await send({ all: true });
    } catch (error) {
      log.warn("alles markeren als gelezen mislukt", { error: String(error) });
      void refresh();
    }
  }, [refresh, send]);

  const value = useMemo(
    () => ({
      notifications: feed.notifications,
      unread: feed.unread,
      loading,
      refresh,
      markRead,
      markAllRead,
      toastOnce,
    }),
    [feed, loading, refresh, markRead, markAllRead, toastOnce],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

/** Van een bewaarde melding naar het blokje op het scherm. */
export function toastFor(notification: Notification): ToastInput {
  return {
    tone: notification.tone,
    title: notification.title,
    description: notification.body,
    action:
      notification.href && notification.actionLabel
        ? { label: notification.actionLabel, href: notification.href }
        : undefined,
  };
}

function read(notification: Notification, at: string): Notification {
  return notification.readAt ? notification : { ...notification, readAt: at };
}

/** De teller volgt uit de lijst; hij wordt nooit apart opgeteld of afgetrokken. */
function apply(
  feed: NotificationFeed,
  map: (notification: Notification) => Notification,
): NotificationFeed {
  const notifications = feed.notifications.map(map);

  return {
    notifications,
    unread: notifications.filter((notification) => !notification.readAt).length,
  };
}
