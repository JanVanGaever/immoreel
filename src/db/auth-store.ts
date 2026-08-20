import { randomUUID } from "node:crypto";
import type {
  AuthToken,
  AuthTokenPurpose,
  ID,
  Membership,
  Organisation,
  Role,
  UserRecord,
} from "@/types";

/**
 * Alle lees- en schrijfacties die de auth-laag nodig heeft, achter één poort.
 * Zolang er geen ORM gekozen is, draait hieronder een in-memory implementatie;
 * de rest van de app merkt daar niets van.
 *
 * Een echte databank aansluiten betekent: één nieuwe implementatie van
 * `AuthStore` schrijven en die teruggeven uit `getAuthStore()`.
 */
export type AuthStore = {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(userId: ID): Promise<UserRecord | null>;
  /** Maakt gebruiker, organisatie en het owner-lidmaatschap in één keer aan. */
  createAccount(input: CreateAccountInput): Promise<CreateAccountResult>;
  setPasswordHash(userId: ID, passwordHash: string): Promise<void>;
  setUserName(userId: ID, name: string): Promise<void>;
  markEmailVerified(userId: ID): Promise<void>;
  /** De organisatie waarin de gebruiker werkt. Voorlopig één per gebruiker. */
  findMembershipByUser(userId: ID): Promise<Membership | null>;
  findOrganisation(organisationId: ID): Promise<Organisation | null>;
  /* --- Team: de lidmaatschappen van één organisatie ---------------------- */
  /** Iedereen die bij dit kantoor hoort, oudste lidmaatschap eerst. */
  listMemberships(organisationId: ID): Promise<Membership[]>;
  findMembership(membershipId: ID): Promise<Membership | null>;
  /** Voor wie via een uitnodiging binnenkomt: een gebruiker zonder eigen kantoor. */
  createUser(input: CreateUserInput): Promise<UserRecord>;
  createMembership(input: CreateMembershipInput): Promise<Membership>;
  updateMembershipRole(membershipId: ID, role: Role): Promise<Membership | null>;
  deleteMembership(membershipId: ID): Promise<void>;
  createAuthToken(input: CreateAuthTokenInput): Promise<AuthToken>;
  /** Geeft het token terug en markeert het meteen als gebruikt (eenmalig). */
  consumeAuthToken(purpose: AuthTokenPurpose, tokenHash: string): Promise<AuthToken | null>;
  /** Trekt openstaande tokens in, bijvoorbeeld na een geslaagde wachtwoordreset. */
  revokeAuthTokens(userId: ID, purpose: AuthTokenPurpose): Promise<void>;
};

export type CreateAccountInput = {
  name: string;
  email: string;
  passwordHash: string | null;
  organisationName: string;
};

export type CreateAccountResult = {
  user: UserRecord;
  organisation: Organisation;
  membership: Membership;
};

export type CreateUserInput = {
  name: string;
  email: string;
  passwordHash: string | null;
  /** Wie via een uitnodigingslink binnenkomt, bewijst dat hij bij de mailbox kan. */
  emailVerified?: boolean;
};

export type CreateMembershipInput = {
  userId: ID;
  organisationId: ID;
  role: Role;
};

export type CreateAuthTokenInput = {
  userId: ID;
  purpose: AuthTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
};

/** Rol die de aanmaker van een organisatie krijgt. */
export const DEFAULT_ROLE_ON_SIGNUP: Role = "owner";

/** Normaliseert een e-mailadres, zodat "Jan@X.be " en "jan@x.be" gelijk zijn. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

type MemoryData = {
  users: Map<ID, UserRecord>;
  organisations: Map<ID, Organisation>;
  memberships: Map<ID, Membership>;
  authTokens: Map<ID, AuthToken>;
};

declare global {
  var __immoreelAuthData: MemoryData | undefined;
}

/**
 * In dev overleeft de data zo een hot reload. In productie hoort hier een
 * echte databank te staan: dit geheugen is leeg na elke herstart en wordt
 * niet gedeeld tussen instanties.
 */
function getData(): MemoryData {
  globalThis.__immoreelAuthData ??= seed({
    users: new Map(),
    organisations: new Map(),
    memberships: new Map(),
    authTokens: new Map(),
  });

  return globalThis.__immoreelAuthData;
}

/**
 * Eén demoaccount zodat de auth-schermen meteen te proberen zijn:
 * demo@immoreel.be met wachtwoord Immoreel2026!
 * Buiten development wordt er niets geseed.
 */
function seed(data: MemoryData): MemoryData {
  if (process.env.NODE_ENV === "production") return data;

  const now = new Date().toISOString();
  const userId = "usr_demo";
  const organisationId = "org_demo";

  data.users.set(userId, {
    id: userId,
    email: "demo@immoreel.be",
    name: "Demo Gebruiker",
    avatarUrl: null,
    emailVerifiedAt: now,
    passwordHash:
      "scrypt$16384$8$1$TTlrri4u_WkrWvEesVvhBg$Ct2xMR8TOH6oF6pC3s6oDaM3At8JLgVqlHfaRfJq5afMN-eFvmzc4xQ2KiSsc-hpTJX3eAhjRAZ_MWfg7MKjUQ",
    createdAt: now,
    updatedAt: now,
  });

  data.organisations.set(organisationId, {
    id: organisationId,
    name: "Demo Vastgoed",
    slug: "demo-vastgoed",
    vatNumber: null,
    logoUrl: null,
    createdAt: now,
    updatedAt: now,
  });

  data.memberships.set("mem_demo", {
    id: "mem_demo",
    userId,
    organisationId,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  });

  // Twee collega's, zodat de teampagina in development meer laat zien dan één
  // rij met jezelf erin. Ze hebben geen wachtwoord: inloggen doen ze niet, ze
  // staan er om rollen, badges en verwijderen te kunnen proberen.
  const colleagues: { id: ID; membershipId: ID; name: string; email: string; role: Role }[] = [
    {
      id: "usr_demo_editor",
      membershipId: "mem_demo_editor",
      name: "Sofie Peeters",
      email: "sofie@immoreel.be",
      role: "editor",
    },
    {
      id: "usr_demo_viewer",
      membershipId: "mem_demo_viewer",
      name: "Karel Maes",
      email: "karel@immoreel.be",
      role: "viewer",
    },
  ];

  for (const [index, colleague] of colleagues.entries()) {
    const joinedAt = new Date(Date.now() - (index + 1) * 86_400_000).toISOString();

    data.users.set(colleague.id, {
      id: colleague.id,
      email: colleague.email,
      name: colleague.name,
      avatarUrl: null,
      emailVerifiedAt: joinedAt,
      passwordHash: null,
      createdAt: joinedAt,
      updatedAt: joinedAt,
    });

    data.memberships.set(colleague.membershipId, {
      id: colleague.membershipId,
      userId: colleague.id,
      organisationId,
      role: colleague.role,
      createdAt: joinedAt,
      updatedAt: joinedAt,
    });
  }

  return data;
}

function uniqueSlug(data: MemoryData, base: string): string {
  const taken = new Set([...data.organisations.values()].map((organisation) => organisation.slug));
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

const memoryStore: AuthStore = {
  async findUserByEmail(email) {
    const wanted = normaliseEmail(email);
    for (const user of getData().users.values()) {
      if (user.email === wanted) return user;
    }
    return null;
  },

  async findUserById(userId) {
    return getData().users.get(userId) ?? null;
  },

  async createAccount({ name, email, passwordHash, organisationName }) {
    const data = getData();
    const now = new Date().toISOString();

    const user: UserRecord = {
      id: `usr_${randomUUID()}`,
      email: normaliseEmail(email),
      name: name.trim(),
      avatarUrl: null,
      passwordHash,
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const organisation: Organisation = {
      id: `org_${randomUUID()}`,
      name: organisationName.trim(),
      slug: uniqueSlug(data, slugify(organisationName) || "kantoor"),
      vatNumber: null,
      logoUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    const membership: Membership = {
      id: `mem_${randomUUID()}`,
      userId: user.id,
      organisationId: organisation.id,
      role: DEFAULT_ROLE_ON_SIGNUP,
      createdAt: now,
      updatedAt: now,
    };

    data.users.set(user.id, user);
    data.organisations.set(organisation.id, organisation);
    data.memberships.set(membership.id, membership);

    return { user, organisation, membership };
  },

  async setPasswordHash(userId, passwordHash) {
    const user = getData().users.get(userId);
    if (!user) return;

    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
  },

  async setUserName(userId, name) {
    const user = getData().users.get(userId);
    if (!user) return;

    user.name = name.trim();
    user.updatedAt = new Date().toISOString();
  },

  async markEmailVerified(userId) {
    const user = getData().users.get(userId);
    if (!user || user.emailVerifiedAt) return;

    const now = new Date().toISOString();
    user.emailVerifiedAt = now;
    user.updatedAt = now;
  },

  async findMembershipByUser(userId) {
    for (const membership of getData().memberships.values()) {
      if (membership.userId === userId) return membership;
    }
    return null;
  },

  async findOrganisation(organisationId) {
    return getData().organisations.get(organisationId) ?? null;
  },

  async listMemberships(organisationId) {
    return [...getData().memberships.values()]
      .filter((membership) => membership.organisationId === organisationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async findMembership(membershipId) {
    return getData().memberships.get(membershipId) ?? null;
  },

  async createUser({ name, email, passwordHash, emailVerified = false }) {
    const now = new Date().toISOString();
    const user: UserRecord = {
      id: `usr_${randomUUID()}`,
      email: normaliseEmail(email),
      name: name.trim(),
      avatarUrl: null,
      passwordHash,
      emailVerifiedAt: emailVerified ? now : null,
      createdAt: now,
      updatedAt: now,
    };

    getData().users.set(user.id, user);

    return user;
  },

  async createMembership({ userId, organisationId, role }) {
    const now = new Date().toISOString();
    const membership: Membership = {
      id: `mem_${randomUUID()}`,
      userId,
      organisationId,
      role,
      createdAt: now,
      updatedAt: now,
    };

    getData().memberships.set(membership.id, membership);

    return membership;
  },

  async updateMembershipRole(membershipId, role) {
    const membership = getData().memberships.get(membershipId);
    if (!membership) return null;

    membership.role = role;
    membership.updatedAt = new Date().toISOString();

    return membership;
  },

  async deleteMembership(membershipId) {
    // De gebruiker zelf blijft bestaan: hij hoort alleen niet meer bij dit
    // kantoor. Zonder lidmaatschap komt hij nergens meer binnen — zie
    // `getSession()`, dat zonder lidmaatschap geen sessie teruggeeft.
    getData().memberships.delete(membershipId);
  },

  async createAuthToken({ userId, purpose, tokenHash, expiresAt }) {
    const now = new Date().toISOString();
    const token: AuthToken = {
      id: `tok_${randomUUID()}`,
      userId,
      purpose,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    getData().authTokens.set(token.id, token);
    return token;
  },

  async consumeAuthToken(purpose, tokenHash) {
    for (const token of getData().authTokens.values()) {
      if (token.purpose !== purpose || token.tokenHash !== tokenHash) continue;
      if (token.usedAt) return null;
      if (new Date(token.expiresAt).getTime() < Date.now()) return null;

      token.usedAt = new Date().toISOString();
      token.updatedAt = token.usedAt;
      return token;
    }

    return null;
  },

  async revokeAuthTokens(userId, purpose) {
    const now = new Date().toISOString();
    for (const token of getData().authTokens.values()) {
      if (token.userId !== userId || token.purpose !== purpose || token.usedAt) continue;
      token.usedAt = now;
      token.updatedAt = now;
    }
  },
};

export function getAuthStore(): AuthStore {
  // TODO: zodra de ORM gekozen is, hier de databank-implementatie teruggeven
  // (zie `isDatabaseConfigured()` in `src/db/client.ts`).
  return memoryStore;
}
