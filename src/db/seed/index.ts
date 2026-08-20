/**
 * De demodata van development, op één plek.
 *
 * Eén organisatie, drie mensen, drie panden, een huisstijl, drie renders, een
 * betaalgeschiedenis en de meldingen die bij die renders horen. Elke store in
 * `src/db/` haalt zijn beginstand hier op, en daardoor verwijzen ze naar
 * elkaar: het project op het dashboard is het project dat de editor opent, de
 * renderjob eronder hoort bij datzelfde project, en de factuur ernaast bij
 * hetzelfde kantoor.
 *
 * Wat hier staat is data en geen gedrag. De stores beslissen zelf wanneer ze
 * seeden (bij hun eerste aanroep) en of ze het doen (`isSeedEnabled()`).
 *
 * Wil je zien wat een nieuwe klant ziet — leeg dashboard, proefperiode, kale
 * huisstijl — zet dan `IMMOREEL_SEED=off` in `.env.local`.
 */

export {
  SEEDED_AT,
  SEED_MEMBERSHIP_IDS,
  SEED_ORGANISATION_ID,
  SEED_PASSWORD,
  SEED_PROJECT_IDS,
  SEED_USER_IDS,
  isSeedEnabled,
  seedTime,
} from "@/db/seed/config";
export { SEED_USERS, seedMemberships, seedOrganisation, seedUsers } from "@/db/seed/accounts";
export { seedBrandKit } from "@/db/seed/brand";
export { seedProjectMeta, seedProjects } from "@/db/seed/projects";
export { seedOutputUrl, seedRenderJobs, seedRenderMinutes } from "@/db/seed/renders";
export { seedInvoices, seedSubscription } from "@/db/seed/billing";
export { seedNotifications } from "@/db/seed/notifications";
export { SEED_STORAGE_USED_IN_BYTES, seedStorageUsedInBytes } from "@/db/seed/usage";
