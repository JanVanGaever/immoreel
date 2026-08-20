/**
 * De meldingenlaag van Immoreel.
 *
 * Vijf stukken, elk met één taak:
 *
 * - `catalogue.ts`        — per onderwerp: kleur, zin, link, welke schakelaar
 *                           op de accountpagina erover gaat. De enige plek waar
 *                           die vier dingen staan.
 * - `recipients.ts`       — wie krijgt het: de aanvrager, of wie de rekening betaalt.
 * - `service.ts`          — `notify()`: van gebeurtenis naar rij en mail.
 * - `email.ts`            — het tweede kanaal, uit tot er een provider is.
 * - `billing-reminders.ts`— de meldingen die uit een datum volgen in plaats van
 *                           uit een gebeurtenis.
 *
 * Alleen `catalogue.ts` draait ook in de browser (de toast bouwt zijn tekst
 * ermee); de rest raakt de stores en blijft dus op de server. Vandaar dat deze
 * barrel de dienst en de catalogus doorgeeft, en wie de e-mailpoort nodig heeft
 * hem rechtstreeks importeert — dan zie je meteen dat je op de server zit.
 *
 * Wie de lagen eromheen zoekt:
 *
 * - De store        → `@/db/notification-store`
 * - Het scherm      → `@/components/notifications` (de bel) en `@/components/ui` (toasts)
 * - De typen        → `@/types/notification.ts`
 */

export {
  describeEvent,
  entryFor,
  preferenceFor,
  shouldToast,
  toneFor,
} from "@/lib/notifications/catalogue";
export type { NotificationContent, NotificationEntry } from "@/lib/notifications/catalogue";

export { notify } from "@/lib/notifications/service";
export type { NotifyResult } from "@/lib/notifications/service";

export {
  CANCELLATION_REMINDER_DAYS,
  TRIAL_REMINDER_DAYS,
  billingReminders,
  syncBillingReminders,
} from "@/lib/notifications/billing-reminders";

export { findBillingManagers, resolveRecipients } from "@/lib/notifications/recipients";
