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

/**
 * Eenmalige tokens uit een e-mail: wachtwoordherstel, magic link en het
 * bevestigen van een nieuw e-mailadres.
 */
export type AuthTokenPurpose = "password-reset" | "magic-link" | "email-change";

export type AuthToken = {
  id: ID;
  userId: ID;
  purpose: AuthTokenPurpose;
  /** Alleen de SHA-256 van het token; de klare tekst staat enkel in de e-mail. */
  tokenHash: string;
  /**
   * Het nieuwe e-mailadres bij `email-change`. Het staat hier en niet al op de
   * gebruiker: pas wie op de link in díé mailbox klikt, bewijst dat het adres
   * van hem is.
   */
  email?: string | null;
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

/**
 * De taal waarin een gebruiker wil werken. Belgisch: Nederlands en Frans,
 * met Engels erbij voor internationale collega's.
 */
export type Locale = "nl-BE" | "fr-BE" | "en";

/**
 * Waarover we een gebruiker mogen mailen. Bewust per onderwerp en niet één
 * schakelaar: wie zijn renders wil opvolgen, wil daarom nog geen productnieuws.
 */
export type NotificationPreferences = {
  /** Een video is klaar en staat klaar om te downloaden. */
  renderKlaar: boolean;
  /** Een render of export is mislukt. */
  renderMislukt: boolean;
  /** Iemand komt erbij, krijgt een andere rol of gaat weg. */
  teamWijzigingen: boolean;
  /** Facturen, mislukte betalingen en het einde van de proefperiode. */
  facturatie: boolean;
  /** Nieuwe templates en functies. */
  productnieuws: boolean;
};

/** De persoonlijke instellingen van één gebruiker, los van zijn kantoor. */
export type UserPreferences = {
  userId: ID;
  locale: Locale;
  notifications: NotificationPreferences;
} & Timestamps;

export type UserPreferencesInput = {
  locale: Locale;
  notifications: NotificationPreferences;
};

/**
 * Een e-mailwijziging die nog bevestigd moet worden op het nieuwe adres.
 * Zonder token: dat staat alleen in de link.
 */
export type PendingEmailChange = {
  email: string;
  expiresAt: string;
};
