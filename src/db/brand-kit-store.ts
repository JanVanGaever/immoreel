import { createBrandKit } from "@/lib/brand/kit";
import { sanitizeBrandKit } from "@/lib/brand/validation";
import type { BrandKit, BrandKitInput, ID } from "@/types";

/**
 * De huisstijl per organisatie, achter één poort — net als `AuthStore` en
 * `ProjectStore`.
 *
 * Eén kit per organisatie: `getBrandKit()` geeft er altijd een terug. Een
 * kantoor dat nog nooit iets ingesteld heeft, krijgt de standaardkit in plaats
 * van `null`, zodat geen enkele preview of render hoeft na te denken over
 * "wat als er geen huisstijl is".
 *
 * De implementatie hieronder houdt alles in het geheugen van het proces. Zodra
 * de ORM gekozen is, schrijf je één nieuwe implementatie van dezelfde
 * interface; de pagina en de renderpijplijn merken daar niets van.
 */
export type BrandKitStore = {
  /** Altijd een kit: de opgeslagen versie, of de standaard voor dit kantoor. */
  getBrandKit(organisationId: ID): Promise<BrandKit>;
  /** Bewaart de kit en geeft terug wat er nu écht staat. */
  saveBrandKit(organisationId: ID, input: BrandKitInput): Promise<BrandKit>;
};

declare global {
  var __immoreelBrandKits: Map<ID, BrandKit> | undefined;
}

function getData(): Map<ID, BrandKit> {
  globalThis.__immoreelBrandKits ??= new Map();

  return globalThis.__immoreelBrandKits;
}

/** De organisatie die bij het demoaccount hoort (zie `auth-store.ts`). */
const DEMO_ORGANISATION_ID = "org_demo";

/**
 * Het demokantoor heeft een ingevulde huisstijl, zodat de eindkaart in de
 * preview meteen ergens op slaat. Een nieuwe organisatie begint bij de
 * standaardkit met een leeg contactblok — precies wat de instellingenpagina
 * dan ook laat zien.
 */
function seed(organisationId: ID): BrandKit {
  if (organisationId !== DEMO_ORGANISATION_ID) return createBrandKit(organisationId);

  return createBrandKit(organisationId, {
    primaryColor: "#0f5f57",
    secondaryColor: "#e7c98a",
    outroText: "Benieuwd naar dit pand?",
    ctaText: "Plan je bezoek",
    contact: {
      agentName: "Vastgoedkantoor Janssens",
      phone: "+32 3 234 56 78",
      email: "info@janssens.be",
      website: "www.janssens.be",
    },
    fontId: "inter",
    watermarkByDefault: true,
  });
}

const memoryStore: BrandKitStore = {
  async getBrandKit(organisationId) {
    const existing = getData().get(organisationId);
    if (existing) return existing;

    const kit = seed(organisationId);
    getData().set(organisationId, kit);

    return kit;
  },

  async saveBrandKit(organisationId, input) {
    const current = await this.getBrandKit(organisationId);

    // Ook hier nog een keer: wat er binnenkomt is niet noodzakelijk door het
    // formulier gegaan, en een halve hexcode in de databank is een render die
    // stukloopt in plaats van een veld dat rood kleurt.
    const kit: BrandKit = {
      ...current,
      ...sanitizeBrandKit(input),
      updatedAt: new Date().toISOString(),
    };

    getData().set(organisationId, kit);

    return kit;
  },
};

export function getBrandKitStore(): BrandKitStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  return memoryStore;
}
