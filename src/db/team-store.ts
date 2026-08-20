import { randomUUID } from "node:crypto";
import { getAuthStore, normaliseEmail } from "@/db/auth-store";
import { invitationStatus } from "@/lib/team/invitations";
import type { ID, Invitation, InvitationSummary, Role, TeamMember } from "@/types";

/**
 * Het team van één organisatie achter één poort: wie er lid is, en wie er
 * uitgenodigd staat.
 *
 * De leden zelf horen bij `AuthStore` — dat zijn de tabellen `users` en
 * `memberships`, en de sessie leest ze bij elk verzoek. Deze store voegt daar
 * de uitnodigingen aan toe en zet beide om naar wat het scherm nodig heeft:
 * een lid mét zijn gebruiker, een uitnodiging zónder haar token.
 *
 * Zoals overal draait hieronder de in-memory versie. Een databank aansluiten
 * is één nieuwe implementatie van dezelfde interface.
 */
export type TeamStore = {
  /** Iedereen die bij dit kantoor hoort. Eigenaars eerst, dan op anciënniteit. */
  listMembers(organisationId: ID): Promise<TeamMember[]>;
  /** Eén lid, mét de gebruiker erachter. `null` als het lidmaatschap niet (meer) bestaat. */
  findMember(organisationId: ID, membershipId: ID): Promise<TeamMember | null>;
  /** Openstaande uitnodigingen, nieuwste eerst. Aanvaarde en ingetrokken vallen weg. */
  listInvitations(organisationId: ID): Promise<InvitationSummary[]>;
  /** Een openstaande uitnodiging voor dit adres, om dubbel uitnodigen te weren. */
  findOpenInvitationByEmail(organisationId: ID, email: string): Promise<Invitation | null>;
  findInvitation(organisationId: ID, invitationId: ID): Promise<Invitation | null>;
  /** Zoekt op de hash uit de link; over alle organisaties heen, want de link staat op zichzelf. */
  findInvitationByTokenHash(tokenHash: string): Promise<Invitation | null>;
  createInvitation(input: CreateInvitationInput): Promise<Invitation>;
  /** Nieuw token en nieuwe vervaldatum op dezelfde uitnodiging. */
  refreshInvitation(invitationId: ID, input: RefreshInvitationInput): Promise<Invitation | null>;
  markInvitationAccepted(invitationId: ID): Promise<void>;
  revokeInvitation(invitationId: ID): Promise<void>;
};

export type CreateInvitationInput = {
  organisationId: ID;
  email: string;
  role: Role;
  invitedByUserId: ID;
  tokenHash: string;
  expiresAt: Date;
};

export type RefreshInvitationInput = {
  tokenHash: string;
  expiresAt: Date;
  invitedByUserId: ID;
};

declare global {
  var __immoreelInvitations: Map<ID, Invitation> | undefined;
}

function getData(): Map<ID, Invitation> {
  globalThis.__immoreelInvitations ??= new Map();

  return globalThis.__immoreelInvitations;
}

/** Hoger getal = meer rechten; bepaalt de volgorde in de lijst. */
const ROLE_ORDER: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };

const memoryStore: TeamStore = {
  async listMembers(organisationId) {
    const store = getAuthStore();
    const memberships = await store.listMemberships(organisationId);
    const members: TeamMember[] = [];

    for (const membership of memberships) {
      const record = await store.findUserById(membership.userId);
      // Een lidmaatschap zonder gebruiker hoort niet te bestaan; het overslaan
      // is beter dan de hele pagina laten vallen over één weesrij.
      if (!record) continue;

      members.push({
        membershipId: membership.id,
        user: {
          id: record.id,
          email: record.email,
          name: record.name,
          avatarUrl: record.avatarUrl ?? null,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
        role: membership.role,
        joinedAt: membership.createdAt,
      });
    }

    // Eigenaars bovenaan: dat is de vraag waarmee iemand deze lijst opent —
    // "wie kan hier iets beslissen?"
    return members.sort(
      (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt.localeCompare(b.joinedAt),
    );
  },

  async findMember(organisationId, membershipId) {
    const members = await this.listMembers(organisationId);

    return members.find((member) => member.membershipId === membershipId) ?? null;
  },

  async listInvitations(organisationId) {
    const store = getAuthStore();
    const open = [...getData().values()]
      .filter(
        (invitation) =>
          invitation.organisationId === organisationId &&
          invitationStatus(invitation) === "openstaand",
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const summaries: InvitationSummary[] = [];

    for (const invitation of open) {
      const inviter = await store.findUserById(invitation.invitedByUserId);

      summaries.push({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitationStatus(invitation),
        invitedByName: inviter?.name ?? null,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
      });
    }

    return summaries;
  },

  async findOpenInvitationByEmail(organisationId, email) {
    const wanted = normaliseEmail(email);

    for (const invitation of getData().values()) {
      if (invitation.organisationId !== organisationId) continue;
      if (invitation.email !== wanted) continue;
      if (invitationStatus(invitation) !== "openstaand") continue;

      return invitation;
    }

    return null;
  },

  async findInvitation(organisationId, invitationId) {
    const invitation = getData().get(invitationId);
    if (!invitation || invitation.organisationId !== organisationId) return null;

    return invitation;
  },

  async findInvitationByTokenHash(tokenHash) {
    for (const invitation of getData().values()) {
      if (invitation.tokenHash === tokenHash) return invitation;
    }

    return null;
  },

  async createInvitation({ organisationId, email, role, invitedByUserId, tokenHash, expiresAt }) {
    const now = new Date().toISOString();
    const invitation: Invitation = {
      id: `inv_${randomUUID()}`,
      organisationId,
      email: normaliseEmail(email),
      role,
      invitedByUserId,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      acceptedAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    getData().set(invitation.id, invitation);

    return invitation;
  },

  async refreshInvitation(invitationId, { tokenHash, expiresAt, invitedByUserId }) {
    const invitation = getData().get(invitationId);
    if (!invitation) return null;

    // Opnieuw versturen maakt een nieuwe link: de oude hash verdwijnt, dus de
    // vorige mail werkt niet meer. Dat is de bedoeling — er is er altijd maar
    // één geldig.
    invitation.tokenHash = tokenHash;
    invitation.expiresAt = expiresAt.toISOString();
    invitation.invitedByUserId = invitedByUserId;
    invitation.revokedAt = null;
    invitation.updatedAt = new Date().toISOString();

    return invitation;
  },

  async markInvitationAccepted(invitationId) {
    const invitation = getData().get(invitationId);
    if (!invitation || invitation.acceptedAt) return;

    const now = new Date().toISOString();
    invitation.acceptedAt = now;
    invitation.updatedAt = now;
  },

  async revokeInvitation(invitationId) {
    const invitation = getData().get(invitationId);
    if (!invitation || invitation.acceptedAt) return;

    const now = new Date().toISOString();
    invitation.revokedAt = now;
    invitation.updatedAt = now;
  },
};

export function getTeamStore(): TeamStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  return memoryStore;
}
