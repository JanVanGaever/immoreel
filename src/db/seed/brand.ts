import { SEED_ORGANISATION_ID, days, seedTime } from "@/db/seed/config";
import { createBrandKit } from "@/lib/brand/kit";
import type { BrandKit } from "@/types";

/**
 * De huisstijl van het demokantoor.
 *
 * Ingevuld en niet standaard, want de standaardkit heeft een leeg contactblok
 * en dan toont de eindkaart in elke preview een lege kaart. Met deze kit staat
 * er een naam, een nummer en een website op — precies wat er in een echte
 * pandvideo hoort te staan, en meteen de test of `resolveBrand()` doet wat het
 * belooft.
 *
 * Let op: de inhoud hiervan telt mee in de vingerafdruk van een render (zie
 * `renders.ts`). Wijzigt hier een kleur of een zin, dan krijgen de geseede
 * renderjobs een andere id en klopt het "deze render bestaat al"-pad niet meer.
 * `npm run seed -- --check` zegt het wanneer dat gebeurt.
 */
export function seedBrandKit(): BrandKit {
  return {
    ...createBrandKit(SEED_ORGANISATION_ID, {
      primaryColor: "#0f5f57",
      secondaryColor: "#c8a45c",
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
    }),
    createdAt: seedTime(-days(188)),
    updatedAt: seedTime(-days(12)),
  };
}
