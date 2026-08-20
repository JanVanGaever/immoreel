import { createPreferences, normalisePreferences } from "@/lib/account/preferences";
import type { ID, UserPreferences, UserPreferencesInput } from "@/types";

/**
 * De persoonlijke instellingen van één gebruiker: taal en waarover hij gemaild
 * wil worden.
 *
 * Ze staan bewust náást `AuthStore` en niet erin. Wat daar leeft — adres,
 * wachtwoord, lidmaatschap — bepaalt of iemand binnen mag; wat hier leeft,
 * bepaalt alleen hoe de app zich gedraagt als hij binnen is. Een kapotte
 * voorkeur mag nooit een inlog tegenhouden.
 *
 * Net als bij de huisstijl geeft `getPreferences()` altijd iets terug: wie
 * nooit iets instelde, krijgt de standaard in plaats van `null`.
 */
export type AccountStore = {
  getPreferences(userId: ID): Promise<UserPreferences>;
  savePreferences(userId: ID, input: UserPreferencesInput): Promise<UserPreferences>;
  /** Bij het verwijderen van een account: de voorkeuren gaan mee. */
  deletePreferences(userId: ID): Promise<void>;
};

declare global {
  var __immoreelPreferences: Map<ID, UserPreferences> | undefined;
}

function getData(): Map<ID, UserPreferences> {
  globalThis.__immoreelPreferences ??= new Map();

  return globalThis.__immoreelPreferences;
}

const memoryStore: AccountStore = {
  async getPreferences(userId) {
    const existing = getData().get(userId);
    if (existing) return existing;

    return createPreferences(userId);
  },

  async savePreferences(userId, input) {
    const current = await this.getPreferences(userId);

    // Ook hier nog een keer normaliseren: wat er binnenkomt is niet
    // noodzakelijk door het formulier gegaan, en een onbekende taalcode in de
    // databank is een `Intl`-aanroep die straks stukloopt.
    const preferences: UserPreferences = {
      ...current,
      ...normalisePreferences(input),
      updatedAt: new Date().toISOString(),
    };

    getData().set(userId, preferences);

    return preferences;
  },

  async deletePreferences(userId) {
    getData().delete(userId);
  },
};

export function getAccountStore(): AccountStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  return memoryStore;
}
