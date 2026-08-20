import { DEFAULT_LOCALE } from "@/lib/constants";
import type {
  ID,
  Locale,
  NotificationPreferences,
  UserPreferences,
  UserPreferencesInput,
} from "@/types";

/**
 * De catalogus van talen en meldingen, plus de enige plek waar een
 * `UserPreferences` ontstaat.
 *
 * Puur en zonder server-imports: het formulier en de serveractie gebruiken
 * dezelfde lijsten, zodat er nooit een schakelaar op het scherm staat die de
 * server niet kent.
 */

export type LocaleOption = {
  id: Locale;
  /** Hoe de taal in die taal zelf heet. */
  label: string;
  description: string;
};

export const LOCALES: readonly LocaleOption[] = [
  { id: "nl-BE", label: "Nederlands", description: "Belgisch Nederlands" },
  { id: "fr-BE", label: "Français", description: "Frans (België)" },
  { id: "en", label: "English", description: "Engels" },
];

export const DEFAULT_USER_LOCALE: Locale = DEFAULT_LOCALE;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.some((locale) => locale.id === value);
}

export function findLocale(id: Locale): LocaleOption {
  return LOCALES.find((locale) => locale.id === id) ?? LOCALES[0]!;
}

export type NotificationKey = keyof NotificationPreferences;

export type NotificationItem = {
  id: NotificationKey;
  label: string;
  description: string;
  /** Aan voor wie niets instelt. */
  standaard: boolean;
};

/**
 * Wat we mogen sturen, per onderwerp.
 *
 * De eerste twee staan standaard aan en de rest niet: een mail over een render
 * die klaar is, is de reden dat iemand het scherm dichtdoet en gaat verder
 * werken. Productnieuws is dat niet — daarvoor kies je zelf.
 */
export const NOTIFICATION_ITEMS: readonly NotificationItem[] = [
  {
    id: "renderKlaar",
    label: "Video klaar",
    description: "Als een video afgewerkt is en klaarstaat om te downloaden.",
    standaard: true,
  },
  {
    id: "renderMislukt",
    label: "Render of export mislukt",
    description: "Als er iets misloopt, zodat je niet zit te wachten op niets.",
    standaard: true,
  },
  {
    id: "teamWijzigingen",
    label: "Wijzigingen in je team",
    description: "Als er een collega bijkomt, een andere rol krijgt of vertrekt.",
    standaard: false,
  },
  {
    id: "facturatie",
    label: "Facturatie",
    description: "Facturen, mislukte betalingen en het einde van je proefperiode.",
    standaard: false,
  },
  {
    id: "productnieuws",
    label: "Productnieuws",
    description: "Nieuwe templates en functies. Hooguit een keer per maand.",
    standaard: false,
  },
];

export function createNotificationPreferences(): NotificationPreferences {
  return {
    renderKlaar: true,
    renderMislukt: true,
    teamWijzigingen: false,
    facturatie: false,
    productnieuws: false,
  };
}

export function createPreferences(userId: ID): UserPreferences {
  const now = new Date().toISOString();

  return {
    userId,
    locale: DEFAULT_USER_LOCALE,
    notifications: createNotificationPreferences(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Alles wat binnenkomt gaat hierlangs: een onbekende taal wordt de standaard,
 * en van de meldingen blijft alleen over wat in de catalogus staat. Een
 * schakelaar die morgen verdwijnt, laat zo geen veld achter dat niemand meer
 * kent.
 */
export function normalisePreferences(input: UserPreferencesInput): UserPreferencesInput {
  const notifications = createNotificationPreferences();

  for (const item of NOTIFICATION_ITEMS) {
    notifications[item.id] = Boolean(input.notifications?.[item.id]);
  }

  return {
    locale: isLocale(input.locale) ? input.locale : DEFAULT_USER_LOCALE,
    notifications,
  };
}

/** Voor de samenvatting op het scherm: "3 van de 5 meldingen staan aan". */
export function countEnabledNotifications(notifications: NotificationPreferences): number {
  return NOTIFICATION_ITEMS.filter((item) => notifications[item.id]).length;
}
