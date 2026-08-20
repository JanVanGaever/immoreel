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

/**
 * Eén collega binnen het kantoor, zoals de teampagina hem toont: het
 * lidmaatschap én de gebruiker erachter. `UserRecord` komt hier bewust niet
 * voorbij — wat naar het scherm gaat, bevat nooit een wachtwoordhash.
 */
export type TeamMember = {
  membershipId: ID;
  user: User;
  role: Role;
  /** Sinds wanneer deze collega bij het kantoor hoort. */
  joinedAt: string;
};

/**
 * Een uitnodiging per e-mail. Van dezelfde soort als `AuthToken`: alleen de
 * hash van het token staat opgeslagen, de klare tekst zit enkel in de link.
 */
export type Invitation = {
  id: ID;
  organisationId: ID;
  email: string;
  /** De rol die het lidmaatschap krijgt zodra de uitnodiging aanvaard wordt. */
  role: Role;
  invitedByUserId: ID;
  tokenHash: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
} & Timestamps;

/**
 * Waar een uitnodiging staat. `verlopen` wordt afgeleid uit `expiresAt` en
 * niet opgeslagen: anders moet er een taak rondlopen die rijen bijwerkt.
 */
export type InvitationStatus = "openstaand" | "aanvaard" | "ingetrokken" | "verlopen";

/** De uitnodiging zoals ze op het scherm komt: zonder token, met status. */
export type InvitationSummary = {
  id: ID;
  email: string;
  role: Role;
  status: InvitationStatus;
  /** Naam van wie uitnodigde; `null` als die collega intussen weg is. */
  invitedByName: string | null;
  createdAt: string;
  expiresAt: string;
};
