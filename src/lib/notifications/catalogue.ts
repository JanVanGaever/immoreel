import { ROUTES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  NotificationPayload,
  NotificationPreferenceKey,
  NotificationTone,
  NotificationTopic,
} from "@/types";

/**
 * De catalogus: per onderwerp één rij, en niets wat elders nog eens staat.
 *
 * Dezelfde opzet als `lib/errors/catalogue.ts`, en om dezelfde reden. Vier
 * dingen liggen hier vast, en precies hier:
 *
 * 1. **De zwaarte** — de kleur van het bolletje, de toast en het icoon.
 * 2. **De zin** — titel en tekst, in het Nederlands, uit de gegevens van de
 *    gebeurtenis.
 * 3. **De link** — waar de gebruiker naartoe moet om er iets mee te doen.
 * 4. **De sleutel in de voorkeuren** — welke schakelaar op de accountpagina
 *    bepaalt of we hierover ook mailen.
 *
 * Dat laatste is de reden dat deze tabel bestaat. De schakelaars stonden er al
 * (`NOTIFICATION_ITEMS` in `lib/account/preferences.ts`), maar niets koppelde
 * ze aan een gebeurtenis. Zonder die koppeling is "Video klaar: uit" een belofte
 * die niemand nakomt.
 *
 * Puur en zonder server-imports: de toast in de browser bouwt zijn tekst met
 * dezelfde functie als de mail die de worker verstuurt. Twee plekken die
 * hetzelfde anders zeggen, is precies waar een support-mail mee begint.
 */

/** Wat er uit een gebeurtenis komt: de melding, nog zonder id en ontvanger. */
export type NotificationContent = {
  topic: NotificationTopic;
  tone: NotificationTone;
  title: string;
  body: string;
  href: string | null;
  actionLabel: string | null;
  dedupeKey: string;
};

export type NotificationEntry = {
  tone: NotificationTone;
  /**
   * Welke schakelaar op de accountpagina over dit onderwerp gaat. Bepaalt
   * alleen de e-mail: de melding in de app komt er hoe dan ook, want dat is
   * geen bericht dat we sturen maar een stand die we tonen.
   */
  preference: NotificationPreferenceKey;
  /**
   * Of dit onderwerp een toast verdient zolang het scherm openstaat.
   *
   * `false` voor de facturatieherinneringen: die gaan over een datum die
   * volgende week ligt, en een blokje dat over je scherm schuift terwijl je aan
   * het monteren bent, hoort over iets te gaan wat nú gebeurd is.
   */
  toast: boolean;
};

const ENTRIES: Record<NotificationTopic, NotificationEntry> = {
  "render-klaar": { tone: "success", preference: "renderKlaar", toast: true },
  "render-mislukt": { tone: "danger", preference: "renderMislukt", toast: true },
  "proef-loopt-af": { tone: "info", preference: "facturatie", toast: false },
  "betaling-mislukt": { tone: "danger", preference: "facturatie", toast: true },
  "betaling-gelukt": { tone: "success", preference: "facturatie", toast: false },
  "abonnement-loopt-af": { tone: "warning", preference: "facturatie", toast: false },
};

export function entryFor(topic: NotificationTopic): NotificationEntry {
  return ENTRIES[topic];
}

export function toneFor(topic: NotificationTopic): NotificationTone {
  return ENTRIES[topic].tone;
}

export function preferenceFor(topic: NotificationTopic): NotificationPreferenceKey {
  return ENTRIES[topic].preference;
}

export function shouldToast(topic: NotificationTopic): boolean {
  return ENTRIES[topic].toast;
}

/**
 * De gebeurtenis in woorden.
 *
 * Werkt op de inhoud en niet op de bezorging: dezelfde aanroep bouwt de toast
 * in de browser en de mail op de server.
 *
 * Eén functie met één `switch`, zodat de compiler klaagt zodra er een onderwerp
 * bijkomt waar niemand een zin voor geschreven heeft.
 */
export function describeEvent(event: NotificationPayload): NotificationContent {
  const tone = toneFor(event.topic);

  switch (event.topic) {
    case "render-klaar":
      return {
        topic: event.topic,
        tone,
        title: `Video klaar voor ${event.projectTitle}`,
        body: `${event.presetLabel} is afgewerkt en staat klaar om te downloaden.`,
        href: ROUTES.projectExports(event.projectId),
        actionLabel: "Naar de downloads",
        // Per job, niet per project: een project exporteert naar meerdere
        // platformen tegelijk en elke export is apart nieuws.
        dedupeKey: `render-klaar:${event.jobId}`,
      };

    case "render-mislukt":
      return {
        topic: event.topic,
        tone,
        title: `Export mislukt voor ${event.projectTitle}`,
        body: event.retryable
          ? `${event.presetLabel}: ${event.reason} Je kunt het opnieuw proberen.`
          : `${event.presetLabel}: ${event.reason}`,
        href: ROUTES.projectExports(event.projectId),
        actionLabel: event.retryable ? "Opnieuw proberen" : "Bekijk de export",
        dedupeKey: `render-mislukt:${event.jobId}`,
      };

    case "proef-loopt-af":
      return {
        topic: event.topic,
        tone,
        title: dagenTitel("Je proefperiode loopt af", event.daysLeft),
        body: `Na ${formatDate(event.endsAt)} stoppen de renders. Kies een plan om verder te kunnen werken.`,
        href: ROUTES.billing,
        actionLabel: "Kies een plan",
        // Per dag: één herinnering per dag dat de proef nog loopt, niet één per
        // keer dat iemand de bel opent.
        dedupeKey: `proef-loopt-af:${dayKey(event.endsAt, event.daysLeft)}`,
      };

    case "betaling-mislukt":
      return {
        topic: event.topic,
        tone,
        title: "Je betaling is niet gelukt",
        body: event.reason
          ? `${formatCurrency(event.amountInCents)} kon niet geïnd worden: ${event.reason}`
          : `${formatCurrency(event.amountInCents)} kon niet geïnd worden. Je video's blijven werken, maar dat is niet blijvend.`,
        href: ROUTES.billing,
        actionLabel: "Betaling herstellen",
        dedupeKey: `betaling-mislukt:${event.invoiceId}`,
      };

    case "betaling-gelukt":
      return {
        topic: event.topic,
        tone,
        title: "Betaling ontvangen",
        body: `We hebben ${formatCurrency(event.amountInCents)} ontvangen. Je abonnement loopt verder.`,
        href: ROUTES.billing,
        actionLabel: "Naar de facturatie",
        dedupeKey: `betaling-gelukt:${event.invoiceId}`,
      };

    case "abonnement-loopt-af":
      return {
        topic: event.topic,
        tone,
        title: dagenTitel("Je abonnement loopt af", event.daysLeft),
        body: `Op ${formatDate(event.endsAt)} stopt je abonnement. Daarna kun je geen nieuwe video's meer renderen.`,
        href: ROUTES.billing,
        actionLabel: "Abonnement hervatten",
        dedupeKey: `abonnement-loopt-af:${dayKey(event.endsAt, event.daysLeft)}`,
      };
  }
}

/** "Je proefperiode loopt af over 3 dagen" / "... morgen" / "... vandaag". */
function dagenTitel(prefix: string, daysLeft: number): string {
  if (daysLeft <= 0) return `${prefix} vandaag`;
  if (daysLeft === 1) return `${prefix} morgen`;

  return `${prefix} over ${daysLeft} dagen`;
}

/**
 * De dag waarop deze herinnering slaat, als sleutel.
 *
 * Niet de datum van vandaag maar het aantal dagen dat er nog zijn: dat is wat
 * er in de titel staat. Zo krijgt de gebruiker "nog drie dagen" en later "nog
 * één dag" — twee berichten — en niet drie keer dezelfde zin.
 */
function dayKey(endsAt: string, daysLeft: number): string {
  return `${endsAt.slice(0, 10)}:${Math.max(0, daysLeft)}`;
}
