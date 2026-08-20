import { SEED_ORGANISATION_ID, isSeedEnabled } from "@/db/seed/config";
import type { ID } from "@/types";

/**
 * Het enige cijfer op het dashboard dat nergens uit af te leiden valt.
 *
 * Projecten, renders en zetels worden geteld in de stores waar ze staan. Opslag
 * niet: foto's gaan nog nergens heen (zie de TODO in `project-store.ts`), dus
 * er is geen enkele rij waarvan je bytes kunt optellen. Tot die er is, komt het
 * getal hier vandaan — en alleen voor het demokantoor. Elk ander kantoor staat
 * op nul, want dat is wat het is.
 */
export const SEED_STORAGE_USED_IN_BYTES = Math.round(18.4 * 1024 ** 3);

export function seedStorageUsedInBytes(organisationId: ID): number {
  if (!isSeedEnabled() || organisationId !== SEED_ORGANISATION_ID) return 0;

  return SEED_STORAGE_USED_IN_BYTES;
}
