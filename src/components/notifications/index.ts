/**
 * De meldingen op het scherm.
 *
 * - `notification-provider.tsx` — de lijst, de teller en `toastOnce()`; staat
 *   in `AppShell` en dus onder elk ingelogd scherm.
 * - `notification-menu.tsx`     — de bel in de topbar.
 * - `use-render-toasts.ts`      — de brug van de renderfeed naar een toast.
 *
 * De toasts zelf horen bij het design system (`@/components/ui/toast`), want
 * ze zijn niet van de meldingen alleen: een gelukt formulier mag er ook een
 * tonen. De laag erachter staat in `@/lib/notifications`.
 */

export {
  NotificationProvider,
  toastFor,
  useNotifications,
} from "@/components/notifications/notification-provider";
export type { NotificationContextValue } from "@/components/notifications/notification-provider";

export { NotificationMenu } from "@/components/notifications/notification-menu";
export { useRenderToasts } from "@/components/notifications/use-render-toasts";
