import {
  SEED_MEMBERSHIP_IDS,
  SEED_ORGANISATION_ID,
  SEED_USER_IDS,
  days,
  seedTime,
} from "@/db/seed/config";
import type { Membership, Organisation, Role, UserRecord } from "@/types";

/**
 * Het demokantoor en de drie mensen die er werken.
 *
 * Alle drie hebben ze een wachtwoord, en dat is een keuze: rollen zijn pas te
 * demonstreren als je er ook mee kunt inloggen. Wie als `viewer` binnenkomt,
 * hoort de knop "Nieuw project" niet te zien — dat controleer je door Karel te
 * zijn, niet door een badge te bekijken.
 *
 * De hashes staan er klaar in plaats van berekend te worden. `hashPassword()`
 * is asynchroon en met opzet traag (scrypt, N=16384); drie keer honderd
 * milliseconden bij het opstarten van elke serverinstantie is een prijs die de
 * seed niet hoeft te betalen. Het formaat is dat van
 * `src/lib/auth/password.ts`, dus `verifyPassword()` neemt ze zonder meer aan.
 */

type SeedUser = {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  /** Hoeveel dagen geleden deze collega bij het kantoor kwam. */
  joinedDaysAgo: number;
};

/** Alle drie: `Immoreel2026!` (zie `SEED_PASSWORD`). */
export const SEED_USERS: readonly SeedUser[] = [
  {
    id: SEED_USER_IDS.owner,
    membershipId: SEED_MEMBERSHIP_IDS.owner,
    name: "An Janssens",
    email: "demo@immoreel.be",
    role: "owner",
    passwordHash:
      "scrypt$16384$8$1$ZGVtbyoqKioqKioqKioqKg$ueP92SxM1gHFM59BydaoB8NHoxoxeMLb7vZUteU5OGD_NU5IIHqaqMHqOJje-lESjvmr5nLwmZ2sym6vTp0BNg",
    joinedDaysAgo: 190,
  },
  {
    id: SEED_USER_IDS.editor,
    membershipId: SEED_MEMBERSHIP_IDS.editor,
    name: "Sofie Peeters",
    email: "sofie@immoreel.be",
    role: "editor",
    passwordHash:
      "scrypt$16384$8$1$c29maWUqKioqKioqKioqKg$TuFywcB54hGSvZMAu7wo0K_cw9FTHPj_a9TKSVB9WN49blJgzMYE39qwGSjWp6JAqdyvVpz9v9Dpr3EfvKtqFQ",
    joinedDaysAgo: 142,
  },
  {
    id: SEED_USER_IDS.viewer,
    membershipId: SEED_MEMBERSHIP_IDS.viewer,
    name: "Karel Maes",
    email: "karel@immoreel.be",
    role: "viewer",
    passwordHash:
      "scrypt$16384$8$1$a2FyZWwqKioqKioqKioqKg$AIeoJmCXxQk2NkSYUncXPKMAGQdL4-m2SqWg_frrSZE7WaVRUrQRxiNjOTenZkugWfv1T3iyLX1Bqib3oTEXuA",
    joinedDaysAgo: 38,
  },
];

export function seedOrganisation(): Organisation {
  return {
    id: SEED_ORGANISATION_ID,
    name: "Vastgoedkantoor Janssens",
    slug: "vastgoedkantoor-janssens",
    vatNumber: "BE 0748.512.339",
    // Geen logobestand: er is nog geen object storage, en een kapotte
    // afbeelding op elk scherm is erger dan de initialen uit de huisstijl.
    logoUrl: null,
    createdAt: seedTime(-days(190)),
    updatedAt: seedTime(-days(12)),
  };
}

export function seedUsers(): UserRecord[] {
  return SEED_USERS.map((user) => {
    const joinedAt = seedTime(-days(user.joinedDaysAgo));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: null,
      passwordHash: user.passwordHash,
      // Geverifieerd: een demoaccount dat eerst een e-mail moet bevestigen die
      // nergens aankomt, is geen demoaccount.
      emailVerifiedAt: joinedAt,
      createdAt: joinedAt,
      updatedAt: joinedAt,
    };
  });
}

export function seedMemberships(): Membership[] {
  return SEED_USERS.map((user) => {
    const joinedAt = seedTime(-days(user.joinedDaysAgo));

    return {
      id: user.membershipId,
      userId: user.id,
      organisationId: SEED_ORGANISATION_ID,
      role: user.role,
      createdAt: joinedAt,
      updatedAt: joinedAt,
    };
  });
}
