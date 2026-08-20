"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { useNotifications } from "@/components/notifications/notification-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Notification, NotificationTone } from "@/types";

/**
 * De bel in de topbar.
 *
 * Geen `DropdownMenu`: dat component is een menu volgens het WAI-ARIA
 * menu-button pattern, waarin elk kind een `menuitem` is en de pijltjes
 * daartussen lopen. Een lijst meldingen is geen menu maar een lijst — met per
 * regel een titel, een tekst en soms een link. Er een menu van maken zou
 * betekenen dat een schermlezer zes menu-items voorleest waarvan er twee iets
 * doen.
 *
 * Het gedrag eromheen is wel hetzelfde: buiten klikken sluit, Escape sluit en
 * zet de focus terug op de knop.
 */

const toneIcons: Record<NotificationTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

const toneColors: Record<NotificationTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function NotificationMenu() {
  const { notifications, unread, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-label={unread > 0 ? `Meldingen, ${unread} ongelezen` : "Meldingen"}
        onClick={() => setOpen((value) => !value)}
        className="relative"
      >
        <Bell />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full",
              "bg-danger px-1 text-[0.625rem] leading-4 font-semibold text-white",
            )}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          className={cn(
            "absolute top-[calc(100%+0.375rem)] right-0 z-50 w-[min(22rem,calc(100vw-2rem))]",
            "overflow-hidden rounded-lg border border-border bg-surface shadow-elevated",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <p className="text-sm font-semibold text-fg">Meldingen</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex items-center gap-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
              >
                <CheckCheck className="size-3.5" />
                Alles gelezen
              </button>
            ) : null}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-3.5 py-8 text-sm text-fg-subtle">
                <Spinner label={null} />
                Meldingen ophalen…
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-sm text-fg-subtle">
                Nog geen meldingen. Zodra een video klaar is, staat het hier.
              </p>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <NotificationRow
                      notification={notification}
                      onOpen={() => {
                        void markRead([notification.id]);
                        setOpen(false);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const Icon = toneIcons[notification.tone];

  const content = (
    <div className="flex items-start gap-2.5">
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", toneColors[notification.tone])} />

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-medium text-fg">{notification.title}</p>
        <p className="mt-0.5 text-sm leading-snug text-fg-muted">{notification.body}</p>
        <p className="mt-1 text-xs text-fg-subtle">{formatDateTime(notification.createdAt)}</p>
      </div>

      {notification.readAt ? null : (
        <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
      )}
    </div>
  );

  const className = cn(
    "block w-full px-3.5 py-3 text-left transition-colors hover:bg-surface-subtle",
    "border-b border-border last:border-b-0",
    notification.readAt ? null : "bg-brand-soft/30",
  );

  // Een melding zonder link is geen knop: er valt niets te openen. Wel
  // aanklikbaar om hem als gelezen te markeren — vandaar twee vormen in plaats
  // van een link naar nergens.
  if (!notification.href) {
    return (
      <button type="button" onClick={onOpen} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={notification.href} onClick={onOpen} className={className}>
      {content}
    </Link>
  );
}
