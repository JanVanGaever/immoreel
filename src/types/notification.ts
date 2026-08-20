import type { ID, Timestamps } from "@/types/common";
import type { NotificationPreferences } from "@/types/account";
import type { PlanId } from "@/types/billing";
import type { RenderErrorCode } from "@/types/render";

/**
 * Meldingen: wat de app uit zichzelf tegen een gebruiker zegt.
 *
 * Drie woorden die hier niet hetzelfde betekenen, en het verschil is de hele
 * opzet:
 *
 * - Een **gebeurtenis** (`NotificationEvent`) is wat er gebeurd is. Een render
 *   die klaar is, een incasso die mislukt is. Ze wordt gemaakt door de laag
 *   waar het gebeurt (de worker, de betaaldienst) en zegt niets over vorm.
 * - Een **melding** (`Notification`) is de rij die daaruit volgt: één
 *   gebeurtenis, één ontvanger, een zin in het Nederlands en een link. Ze blijft
 *   staan tot ze gelezen is.
 * - Een **toast** is beeld en geen gegeven. Hij verdwijnt vanzelf en overleeft
 *   geen paginawissel; wie hem mist, mag daardoor niets missen.
 *
 * Dat laatste is de reden dat de toast nooit de enige plek is waar iets staat.
 * Een render die klaar is terwijl de makelaar in een ander tabblad zit, hoort
 * hij bij het terugkomen alsnog te zien — in de bel, niet in een toast die er
 * drie minuten geleden was.
 */

/**
 * Waar een melding over gaat.
 *
 * Nederlands, net als `ProjectStatus` en `SubscriptionStatus`: dit is
 * domeintaal en geen infrastructuur. (De jobstatussen van de renderpijplijn
 * zijn wél Engels — die staan in Redis en in de logs, niet hier.)
 */
export type NotificationTopic =
  /** Een export is afgewerkt en staat klaar om te downloaden. */
  | "render-klaar"
  /** Een export is definitief mislukt; er volgt geen nieuwe poging meer. */
  | "render-mislukt"
  /** De proefperiode loopt binnen een paar dagen af. */
  | "proef-loopt-af"
  /** Een incasso is mislukt. De dienst loopt door, maar niet lang meer. */
  | "betaling-mislukt"
  /** Een betaling is binnen; het abonnement loopt weer. */
  | "betaling-gelukt"
  /** Opgezegd abonnement: na deze datum stoppen de renders. */
  | "abonnement-loopt-af";

/**
 * Hoe zwaar de melding weegt. Dezelfde vier als `AlertVariant` en
 * `BadgeVariant`, zodat een melding op het scherm nergens een eigen kleurtabel
 * nodig heeft.
 */
export type NotificationTone = "info" | "success" | "warning" | "danger";

/** Langs welke weg een melding bij iemand terechtkomt. */
export type NotificationChannel =
  /** De bel in de topbar, en zolang het scherm openstaat een toast. */
  | "in-app"
  /** E-mail. Staat per onderwerp aan of uit in `NotificationPreferences`. */
  | "email";

/**
 * Eén melding voor één gebruiker.
 *
 * `dedupeKey` is wat `fingerprint` is voor een renderjob: dezelfde gebeurtenis
 * levert dezelfde sleutel op, en de store weigert de tweede. Daardoor mag alles
 * hierboven zonder nadenken opnieuw draaien — een webhook die Mollie twee keer
 * aflevert, een reeks facturatieherinneringen die bij elke keer opvragen
 * opnieuw berekend wordt.
 */
export type Notification = {
  id: ID;
  organisationId: ID;
  userId: ID;
  topic: NotificationTopic;
  tone: NotificationTone;
  /** Eén regel, zonder punt: "Video klaar voor Kerkstraat 12". */
  title: string;
  /** Twee regels hoogstens. Wat er gebeurd is en wat het betekent. */
  body: string;
  /** Waar de gebruiker naartoe moet om er iets mee te doen; `null` als er niets te doen valt. */
  href: string | null;
  /** Wat de knop zegt als er een `href` is: "Naar de downloads". */
  actionLabel: string | null;
  /** Zelfde gebeurtenis = zelfde sleutel = één rij. */
  dedupeKey: string;
  readAt: string | null;
} & Timestamps;

/** Wat de bel nodig heeft: de lijst plus het getal op het bolletje. */
export type NotificationFeed = {
  notifications: Notification[];
  unread: number;
};

/* -------------------------------------------------------------------------
 * Gebeurtenissen
 * ---------------------------------------------------------------------- */

/**
 * Wat er gebeurd is, met net genoeg gegevens om er een zin over te schrijven.
 *
 * Bewust ruwe gegevens en geen kant-en-klare tekst: wie een gebeurtenis maakt
 * (de worker, de betaaldienst) hoeft niet te weten hoe ze eruitziet, en de
 * bewoording staat op één plek (`lib/notifications/catalogue.ts`).
 *
 * Er staat hier geen organisatie en geen ontvanger in, en dat is met opzet. De
 * inhoud van een melding hangt niet af van wie hem krijgt — daardoor kan de
 * browser dezelfde zin bouwen voor een toast als de server voor de rij en de
 * mail, zonder ids te kennen die hij toch niet heeft. Bezorging is een tweede
 * laag: `NotificationEvent`.
 */
export type NotificationPayload =
  | {
      topic: "render-klaar";
      projectId: ID;
      projectTitle: string;
      jobId: ID;
      presetLabel: string;
    }
  | {
      topic: "render-mislukt";
      projectId: ID;
      projectTitle: string;
      jobId: ID;
      presetLabel: string;
      /** De Nederlandse zin uit `RenderJobError`, niet het technische detail. */
      reason: string;
      code: RenderErrorCode;
      /** Of de knop "Opnieuw proberen" zin heeft. */
      retryable: boolean;
    }
  | {
      topic: "proef-loopt-af";
      endsAt: string;
      daysLeft: number;
    }
  | {
      topic: "betaling-mislukt";
      invoiceId: ID;
      amountInCents: number;
      /** Wat Mollie erover zegt, in leesbare vorm; `null` als er niets bruikbaars is. */
      reason: string | null;
    }
  | {
      topic: "betaling-gelukt";
      invoiceId: ID;
      amountInCents: number;
      planId: PlanId;
    }
  | {
      topic: "abonnement-loopt-af";
      endsAt: string;
      daysLeft: number;
    };

/**
 * Onderwerpen die bij één persoon horen in plaats van bij het kantoor.
 *
 * Een render is van wie hem gevraagd heeft. Het hele kantoor een belletje geven
 * omdat een collega een export startte, is precies hoe een bel iets wordt wat
 * mensen wegklikken zonder te lezen. Facturatie is het omgekeerde: dat gaat
 * niemand persoonlijk aan, maar wel iedereen die er iets aan kan doen.
 */
export type PersonalNotificationTopic = "render-klaar" | "render-mislukt";

/**
 * Een gebeurtenis zoals `notify()` hem krijgt: de inhoud plus waar hij thuishoort.
 *
 * De ontvanger staat er alleen bij als het onderwerp persoonlijk is; bij de
 * rest zoekt `resolveRecipients()` op wie de facturatie beheert. Het type
 * dwingt dat af, zodat een render zonder aanvrager niet te schrijven valt.
 */
export type NotificationEvent =
  | (Extract<NotificationPayload, { topic: PersonalNotificationTopic }> & {
      organisationId: ID;
      userId: ID;
    })
  | (Exclude<NotificationPayload, { topic: PersonalNotificationTopic }> & {
      organisationId: ID;
      userId?: never;
    });

/** De sleutel in `NotificationPreferences` die bepaalt of we hierover mailen. */
export type NotificationPreferenceKey = keyof NotificationPreferences;

/* -------------------------------------------------------------------------
 * Toasts
 * ---------------------------------------------------------------------- */

/**
 * Een toast zoals het scherm hem kent.
 *
 * Geen `Timestamps` en geen organisatie: dit is beeld dat over een paar
 * seconden weg is. Wat bewaard moet blijven, is een `Notification`.
 */
export type Toast = {
  id: string;
  tone: NotificationTone;
  title: string;
  description?: string;
  /** Hoogstens één, en altijd iets wat de gebruiker verder helpt. */
  action?: { label: string; href: string };
  /**
   * Hoe lang hij blijft staan, in milliseconden. `0` betekent: tot de gebruiker
   * hem wegklikt. Fouten krijgen dat standaard — wie iets moet lezen, mag niet
   * moeten opschieten.
   */
  durationMs: number;
};

/** Wat een aanroeper meegeeft; de rest vult de provider aan. */
export type ToastInput = Omit<Toast, "id" | "durationMs"> & {
  id?: string;
  durationMs?: number;
};
