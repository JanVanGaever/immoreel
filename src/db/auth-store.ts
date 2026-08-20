import { randomUUID } from "node:crypto";
import { isSeedEnabled, seedMemberships, seedOrganisation, seedUsers } from "@/db/seed";
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
  /** Het adres waarmee ingelogd wordt. Alleen na bevestiging op het nieuwe adres. */
  setUserEmail(userId: ID, email: string): Promise<void>;
  /**
   * Wist de gebruiker, zijn lidmaatschappen en zijn openstaande tokens.
   * Onomkeerbaar; de aanroeper controleert of het mag.
   */
  deleteAccount(userId: ID): Promise<void>;
  /** Voor het kantoor dat leegloopt omdat zijn laatste lid vertrekt. */
  deleteOrganisation(organisationId: ID): Promise<void>;
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
  /* --- Intern: over alle organisaties heen ------------------------------ */
  /**
   * Alleen voor het interne supportpaneel (`src/db/admin-store.ts`).
   *
   * De rest van de app leest nooit over organisaties heen — daar begint elke
   * query bij een `organisationId`, en dat is wat een klant van de ene kant
   * houdt bij de andere. Deze drie staan er apart onder, zodat bij een review
   * meteen zichtbaar is wie ze aanroept.
   */
  listAllUsers(): Promise<UserRecord[]>;
  listAllOrganisations(): Promise<Organisation[]>;
  listAllMemberships(): Promise<Membership[]>;

  createAuthToken(input: CreateAuthTokenInput): Promise<AuthToken>;
  /** Het openstaande token van dit doel, om te tonen wat er nog te bevestigen valt. */
  findOpenAuthToken(userId: ID, purpose: AuthTokenPurpose): Promise<AuthToken | null>;
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
  /** Alleen bij `email-change`: het adres dat na bevestiging het nieuwe wordt. */
  email?: string;
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
 * De beginstand van development: het demokantoor met zijn drie mensen.
 *
 * De data zelf staat in `src/db/seed/` en niet meer hier. Dat is wat de
 * dashboardstore, de projectstore en deze store naar dezelfde organisatie laat
 * wijzen — vroeger had elk van hen zijn eigen demokantoor, met andere ids.
 *
 * Alle drie de gebruikers hebben een wachtwoord (`SEED_PASSWORD`), zodat je
 * rollen kunt uitproberen door in te loggen als de editor of de kijker.
 */
function seed(data: MemoryData): MemoryData {
  if (!isSeedEnabled()) return data;

  const organisation = seedOrganisation();
  data.organisations.set(organisation.id, organisation);

  for (const user of seedUsers()) data.users.set(user.id, user);
  for (const membership of seedMemberships()) data.memberships.set(membership.id, membership);

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

  async setUserEmail(userId, email) {
    const user = getData().users.get(userId);
    if (!user) return;

    const now = new Date().toISOString();
    user.email = normaliseEmail(email);
    // Het nieuwe adres is bevestigd via een link in díé mailbox; het blijft
    // dus geverifieerd, niet ondanks maar dankzij de wijziging.
    user.emailVerifiedAt = now;
    user.updatedAt = now;
  },

  async deleteAccount(userId) {
    const data = getData();

    for (const [id, membership] of data.memberships) {
      if (membership.userId === userId) data.memberships.delete(id);
    }
    for (const [id, token] of data.authTokens) {
      if (token.userId === userId) data.authTokens.delete(id);
    }

    data.users.delete(userId);
  },

  async deleteOrganisation(organisationId) {
    const data = getData();

    for (const [id, membership] of data.memberships) {
      if (membership.organisationId === organisationId) data.memberships.delete(id);
    }

    data.organisations.delete(organisationId);
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

  async listAllUsers() {
    return [...getData().users.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async listAllOrganisations() {
    return [...getData().organisations.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },

  async listAllMemberships() {
    return [...getData().memberships.values()];
  },

  async createAuthToken({ userId, purpose, tokenHash, expiresAt, email }) {
    const now = new Date().toISOString();
    const token: AuthToken = {
      id: `tok_${randomUUID()}`,
      userId,
      purpose,
      tokenHash,
      email: email ? normaliseEmail(email) : null,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    getData().authTokens.set(token.id, token);
    return token;
  },

  async findOpenAuthToken(userId, purpose) {
    for (const token of getData().authTokens.values()) {
      if (token.userId !== userId || token.purpose !== purpose || token.usedAt) continue;
      if (new Date(token.expiresAt).getTime() < Date.now()) continue;

      return token;
    }

    return null;
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
