import type { ID, Timestamps } from "@/types/common";

/**
 * Rollen binnen één organisatie, van veel naar weinig rechten.
 * `owner` wordt automatisch toegekend aan wie de organisatie aanmaakt.
 */
export type Role = "owner" | "editor" | "viewer";

export type User = {
  id: ID;
  email: string;
  name: string;
  avatarUrl?: string | null;
} & Timestamps;

/**
 * De rij zoals ze in de databank staat. Het wachtwoordhash-veld blijft
 * bewust buiten `User`, zodat het nooit per ongeluk naar de client lekt.
 */
export type UserRecord = User & {
  passwordHash: string | null;
  emailVerifiedAt?: string | null;
};

/** Een makelaarskantoor of vastgoedgroep. Alles hangt onder een organisatie. */
export type Organisation = {
  id: ID;
  name: string;
  slug: string;
  vatNumber?: string | null;
  logoUrl?: string | null;
} & Timestamps;

export type Membership = {
  id: ID;
  userId: ID;
  organisationId: ID;
  role: Role;
} & Timestamps;

/** Eenmalige tokens uit een e-mail: wachtwoordherstel en magic link. */
export type AuthTokenPurpose = "password-reset" | "magic-link";

export type AuthToken = {
  id: ID;
  userId: ID;
  purpose: AuthTokenPurpose;
  /** Alleen de SHA-256 van het token; de klare tekst staat enkel in de e-mail. */
  tokenHash: string;
  expiresAt: string;
  usedAt?: string | null;
} & Timestamps;
