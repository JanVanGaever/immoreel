import type { ID } from "@/types";

/**
 * Wanneer de seed draait, en onder welke ids.
 *
 * De demodata staat in `src/db/seed/` en nergens anders. Vóór deze map had elke
 * store zijn eigen `seed()`: de auth-store kende een kantoor met drie mensen,
 * de dashboardstore toonde zes projecten die in de projectstore niet bestonden,
 * en klikken op zo'n project gaf een 404. Eén dataset achter één schakelaar
 * lost dat op — wat het dashboard toont, is wat de editor opent.
 *
 * De ids hieronder zijn vast en niet willekeurig. Dat is wat een demo herhaalbaar
 * maakt: `/editor/prj_demo_leiestraat` opent na elke herstart hetzelfde project,
 * en een screenshot in een ticket blijft kloppen.
 */

/**
 * Draait de seed?
 *
 * Nooit in productie — daar is een lege databank de juiste beginstand. Lokaal
 * zet `IMMOREEL_SEED=off` hem uit, om te zien wat een nieuwe klant ziet: het
 * lege dashboard, de proefperiode, de standaardhuisstijl.
 */
export function isSeedEnabled(): boolean {
  if (process.env.IMMOREEL_SEED === "off") return false;

  return process.env.NODE_ENV !== "production";
}

/**
 * Eén moment voor de hele seed.
 *
 * Elke store seedt op zijn eigen eerste aanroep. Zonder een vast nulpunt zou
 * een factuur van "vandaag" een andere seconde krijgen dan de renderjob van
 * "vandaag", en dan lopen tijdlijnen in het adminpaneel net niet gelijk.
 */
export const SEEDED_AT: Date = new Date();

export const minutes = (n: number): number => n * 60_000;
export const hours = (n: number): number => n * 3_600_000;
export const days = (n: number): number => n * 86_400_000;

/** Een tijdstip ten opzichte van het nulpunt van de seed. Negatief = verleden. */
export function seedTime(offsetInMs: number): string {
  return new Date(SEEDED_AT.getTime() + offsetInMs).toISOString();
}

/** Het demokantoor. Elke store die iets seedt, seedt het voor deze organisatie. */
export const SEED_ORGANISATION_ID: ID = "org_demo";

/** Het wachtwoord van alle drie de demogebruikers. Zie `accounts.ts`. */
export const SEED_PASSWORD = "Immoreel2026!";

export const SEED_USER_IDS = {
  owner: "usr_demo",
  editor: "usr_demo_editor",
  viewer: "usr_demo_viewer",
} as const;

export const SEED_MEMBERSHIP_IDS = {
  owner: "mem_demo",
  editor: "mem_demo_editor",
  viewer: "mem_demo_viewer",
} as const;

export const SEED_PROJECT_IDS = {
  /** Afgewerkt: twee geslaagde renders en dus een downloadpagina met inhoud. */
  herenhuis: "prj_demo_leiestraat",
  /** Mislukt: één render met een fout die te herkansen is. */
  appartement: "prj_demo_zuidpark",
  /** In bewerking: het project om de editor mee te tonen. */
  belEtage: "prj_demo_dageraadplaats",
} as const;
