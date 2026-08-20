"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthStore, normaliseEmail } from "@/db/auth-store";
import { getBillingStore } from "@/db/billing-store";
import { getTeamStore } from "@/db/team-store";
import { AFTER_LOGIN_ROUTE, AUTH_ROUTES } from "@/lib/auth/config";
import { sendTeamInviteEmail } from "@/lib/auth/email";
import { hashPassword } from "@/lib/auth/password";
import { EMAIL_RATE_LIMIT, consumeAttempt } from "@/lib/auth/rate-limit";
import { absoluteUrl, clientKey } from "@/lib/auth/request";
import { ROLE_LABELS, isRole } from "@/lib/auth/roles";
import { assertPermission, createSession } from "@/lib/auth/session";
import { createEmailToken, hashEmailToken } from "@/lib/auth/tokens";
import {
  hasErrors,
  readField,
  validateEmail,
  validateName,
  validatePassword,
  type FieldErrors,
} from "@/lib/auth/validation";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { ROUTES } from "@/lib/constants";
import type { TeamActionState } from "@/lib/team/action-state";
import { INVITATION_TTL_SECONDS, invitationStatus } from "@/lib/team/invitations";
import { checkInvite, checkRemoval, checkRoleChange, countOwners } from "@/lib/team/rules";
import type { ID, Invitation, Organisation, Role } from "@/types";

/**
 * De serveracties achter de teampagina.
 *
 * Drie regels lopen door alles heen:
 *
 * 1. **Elke actie controleert het recht opnieuw.** `assertPermission
 *    ("members:manage")` staat boven elke handeling; wat het scherm toont of
 *    verbergt telt niet mee.
 * 2. **Elke actie controleert de vangnetten opnieuw.** Dezelfde functies uit
 *    `rules.ts` die de knoppen uitschakelen, beslissen hier of het doorgaat.
 *    Anders is "de laatste eigenaar verwijderen" één curl-verzoek ver.
 * 3. **Alles blijft binnen de organisatie van de sessie.** Het id van een
 *    lidmaatschap of uitnodiging komt van de client; er wordt nooit iets
 *    aangeraakt dat niet bij dit kantoor hoort.
 */

function fout(message: string, extra?: Partial<TeamActionState>): TeamActionState {
  return { status: "fout", message, ...extra };
}

function gelukt(message: string, extra?: Partial<TeamActionState>): TeamActionState {
  return { status: "gelukt", message, ...extra };
}

/** De teampagina en het dashboard tonen allebei wie erbij hoort. */
function revalidateTeam(): void {
  revalidatePath(ROUTES.team);
  revalidatePath(ROUTES.settings);
  revalidatePath(ROUTES.dashboard);
}

/**
 * Hoeveel plaatsen dit kantoor heeft en hoeveel ervan bezet zijn. Een
 * openstaande uitnodiging telt mee: ze wordt straks een gebruiker.
 */
async function seatUsage(organisationId: ID) {
  const [subscription, members, invitations] = await Promise.all([
    getBillingStore().getSubscription(organisationId),
    getTeamStore().listMembers(organisationId),
    getTeamStore().listInvitations(organisationId),
  ]);

  return {
    seats: PLAN_LIMITS[subscription.planId].seats,
    members: members.length,
    pendingInvitations: invitations.length,
  };
}

/**
 * De link maken, opslaan en versturen. Gedeeld door uitnodigen en opnieuw
 * versturen, zodat er maar één plek is waar een token ontstaat.
 *
 * De verzending mag mislukken zonder de uitnodiging mee te sleuren: zolang er
 * geen e-mailprovider aan hangt, is de link kopiëren de enige manier om een
 * collega binnen te krijgen. De actie zegt dan ook eerlijk dat de mail niet
 * vertrok.
 */
async function deliverInvite(
  invitation: Invitation,
  token: string,
  organisation: Organisation,
  inviterName: string,
): Promise<{ inviteUrl: string; emailDelivered: boolean }> {
  const inviteUrl = await absoluteUrl(
    `${AUTH_ROUTES.invite}?token=${encodeURIComponent(token)}`,
  );

  try {
    await sendTeamInviteEmail(invitation.email, inviteUrl, {
      organisationName: organisation.name,
      inviterName,
      roleLabel: ROLE_LABELS[invitation.role],
    });

    return { inviteUrl, emailDelivered: true };
  } catch {
    return { inviteUrl, emailDelivered: false };
  }
}

/* -------------------------------------------------------------------------
 * Uitnodigen
 * ---------------------------------------------------------------------- */

export async function inviteMemberAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const { user, organisation, role: actorRole } = await assertPermission("members:manage");

  const email = readField(formData, "email");
  const roleValue = readField(formData, "role");
  const values = { email, role: roleValue };

  const fieldErrors: FieldErrors = {
    email: validateEmail(email),
    role: isRole(roleValue) ? undefined : "Kies een rol.",
  };

  if (hasErrors(fieldErrors) || !isRole(roleValue)) {
    return { status: "fout", fieldErrors, values };
  }

  const seats = await seatUsage(organisation.id);
  const allowed = checkInvite(actorRole, seats);
  if (!allowed.allowed) return fout(allowed.reason ?? "Uitnodigen kan niet.", { values });

  const rate = consumeAttempt(await clientKey("invite"), EMAIL_RATE_LIMIT);
  if (!rate.allowed) {
    return fout("Te veel uitnodigingen na elkaar. Probeer het straks opnieuw.", { values });
  }

  const store = getTeamStore();
  const authStore = getAuthStore();
  const normalised = normaliseEmail(email);

  // Al lid? Dan is een uitnodiging geen fout van de gebruiker maar een
  // misverstand, en het antwoord is de rol aanpassen — niet nog eens mailen.
  const members = await store.listMembers(organisation.id);
  if (members.some((member) => member.user.email === normalised)) {
    return {
      status: "fout",
      fieldErrors: { email: "Deze collega hoort al bij je kantoor." },
      values,
    };
  }

  if (await store.findOpenInvitationByEmail(organisation.id, normalised)) {
    return {
      status: "fout",
      fieldErrors: {
        email: "Er staat al een uitnodiging open voor dit adres. Stuur ze opnieuw of trek ze in.",
      },
      values,
    };
  }

  // Eén kantoor per gebruiker (zie `findMembershipByUser`). Wie ergens anders
  // al lid is, kan er dus niet zomaar bijkomen; dat op voorhand zeggen is
  // duidelijker dan een link die straks weigert.
  //
  // Een account zónder lidmaatschap mag wél: dat is iemand die hier ooit
  // verwijderd werd. Die krijgt straks gewoon zijn lidmaatschap terug in
  // plaats van een tweede account op hetzelfde adres.
  const existing = await authStore.findUserByEmail(normalised);
  if (existing && (await authStore.findMembershipByUser(existing.id))) {
    return {
      status: "fout",
      fieldErrors: {
        email: "Dit adres hoort al bij een ander kantoor op Immoreel.",
      },
      values,
    };
  }

  const token = createEmailToken();
  const invitation = await store.createInvitation({
    organisationId: organisation.id,
    email: normalised,
    role: roleValue,
    invitedByUserId: user.id,
    tokenHash: await hashEmailToken(token),
    expiresAt: new Date(Date.now() + INVITATION_TTL_SECONDS * 1000),
  });

  const delivery = await deliverInvite(invitation, token, organisation, user.name);

  revalidateTeam();

  return gelukt(
    delivery.emailDelivered
      ? `Uitnodiging verstuurd naar ${invitation.email}.`
      : `Uitnodiging staat klaar voor ${invitation.email}, maar de e-mail kon niet verstuurd worden. Deel de link zelf.`,
    delivery,
  );
}

export async function resendInvitationAction(invitationId: ID): Promise<TeamActionState> {
  const { user, organisation } = await assertPermission("members:manage");

  const store = getTeamStore();
  const invitation = await store.findInvitation(organisation.id, invitationId);
  if (!invitation) return fout("Deze uitnodiging bestaat niet meer.");
  if (invitation.acceptedAt) return fout("Deze uitnodiging is al aanvaard.");

  const rate = consumeAttempt(await clientKey("invite"), EMAIL_RATE_LIMIT);
  if (!rate.allowed) {
    return fout("Te veel uitnodigingen na elkaar. Probeer het straks opnieuw.");
  }

  const token = createEmailToken();
  const refreshed = await store.refreshInvitation(invitation.id, {
    tokenHash: await hashEmailToken(token),
    expiresAt: new Date(Date.now() + INVITATION_TTL_SECONDS * 1000),
    invitedByUserId: user.id,
  });

  if (!refreshed) return fout("Deze uitnodiging bestaat niet meer.");

  const delivery = await deliverInvite(refreshed, token, organisation, user.name);

  revalidateTeam();

  return gelukt(
    delivery.emailDelivered
      ? `Nieuwe uitnodiging verstuurd naar ${refreshed.email}. De vorige link werkt niet meer.`
      : `Nieuwe link klaar voor ${refreshed.email}, maar de e-mail kon niet verstuurd worden.`,
    delivery,
  );
}

export async function revokeInvitationAction(invitationId: ID): Promise<TeamActionState> {
  const { organisation } = await assertPermission("members:manage");

  const store = getTeamStore();
  const invitation = await store.findInvitation(organisation.id, invitationId);
  if (!invitation) return fout("Deze uitnodiging bestaat niet meer.");
  if (invitation.acceptedAt) {
    return fout("Deze uitnodiging is al aanvaard. Verwijder de collega uit het team.");
  }

  await store.revokeInvitation(invitation.id);
  revalidateTeam();

  return gelukt(`De uitnodiging voor ${invitation.email} is ingetrokken.`);
}

/* -------------------------------------------------------------------------
 * Rollen en verwijderen
 * ---------------------------------------------------------------------- */

export async function changeMemberRoleAction(
  membershipId: ID,
  nextRole: Role,
): Promise<TeamActionState> {
  const session = await assertPermission("members:manage");
  if (!isRole(nextRole)) return fout("Deze rol bestaat niet.");

  const store = getTeamStore();
  const members = await store.listMembers(session.organisation.id);
  const target = members.find((member) => member.membershipId === membershipId);
  if (!target) return fout("Deze collega hoort niet (meer) bij je kantoor.");

  const check = checkRoleChange(
    { role: session.role, membershipId: session.membershipId },
    { membershipId: target.membershipId, role: target.role },
    nextRole,
    countOwners(members),
  );
  if (!check.allowed) return fout(check.reason ?? "Deze wijziging kan niet.");

  await getAuthStore().updateMembershipRole(target.membershipId, nextRole);
  revalidateTeam();

  // De rol staat niet in het sessiecookie: bij het volgende verzoek van deze
  // collega wordt ze opnieuw opgehaald en werkt de wijziging meteen door.
  return gelukt(`${target.user.name} is nu ${ROLE_LABELS[nextRole].toLowerCase()}.`);
}

export async function removeMemberAction(membershipId: ID): Promise<TeamActionState> {
  const session = await assertPermission("members:manage");

  const store = getTeamStore();
  const members = await store.listMembers(session.organisation.id);
  const target = members.find((member) => member.membershipId === membershipId);
  if (!target) return fout("Deze collega hoort niet (meer) bij je kantoor.");

  const check = checkRemoval(
    { role: session.role, membershipId: session.membershipId },
    { membershipId: target.membershipId, role: target.role },
    countOwners(members),
  );
  if (!check.allowed) return fout(check.reason ?? "Verwijderen kan niet.");

  await getAuthStore().deleteMembership(target.membershipId);
  revalidateTeam();

  return gelukt(`${target.user.name} hoort niet meer bij ${session.organisation.name}.`);
}

/* -------------------------------------------------------------------------
 * Aanvaarden
 * ---------------------------------------------------------------------- */

/**
 * De uitnodiging aanvaarden: account afwerken en meteen binnen zijn.
 *
 * Deze actie draait zonder sessie — de link ís de toegang, precies zoals een
 * magic link. Het token wordt daarom opnieuw opgezocht en opnieuw beoordeeld;
 * wat de pagina eerder toonde, telt niet mee.
 */
export async function acceptInvitationAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const token = readField(formData, "token");
  const name = readField(formData, "name");
  const password = readField(formData, "password");
  const values = { name };

  const fieldErrors: FieldErrors = {
    name: validateName(name),
    password: validatePassword(password),
  };

  if (hasErrors(fieldErrors)) return { status: "fout", fieldErrors, values };

  if (!token) {
    return fout("Deze link is onvolledig. Vraag je collega om een nieuwe.", { values });
  }

  const rate = consumeAttempt(await clientKey("invite-accept"), EMAIL_RATE_LIMIT);
  if (!rate.allowed) {
    return fout("Te veel pogingen. Probeer het straks opnieuw.", { values });
  }

  const teamStore = getTeamStore();
  const authStore = getAuthStore();

  const invitation = await teamStore.findInvitationByTokenHash(await hashEmailToken(token));
  if (!invitation || invitationStatus(invitation) !== "openstaand") {
    return fout("Deze uitnodiging is verlopen, ingetrokken of al gebruikt.", { values });
  }

  const organisation = await authStore.findOrganisation(invitation.organisationId);
  if (!organisation) {
    return fout("Dit kantoor bestaat niet meer.", { values });
  }

  // Wie op de link in zijn mailbox klikt, bewijst dat hij bij die mailbox kan
  // — dezelfde maatstaf als bij een herstellink. Daarom mag hier een
  // wachtwoord gezet worden.
  const passwordHash = await hashPassword(password);
  const existing = await authStore.findUserByEmail(invitation.email);

  // Tussen uitnodigen en aanvaarden kan er een account bijgekomen zijn met
  // hetzelfde adres. Eén kantoor per gebruiker, dus dan houdt het hier op.
  if (existing && (await authStore.findMembershipByUser(existing.id))) {
    return fout("Er bestaat al een account met dit e-mailadres. Log in met dat account.", {
      values,
    });
  }

  // Een account zonder lidmaatschap is iemand die hier ooit verwijderd werd:
  // die krijgt zijn eigen account terug, niet een tweede op hetzelfde adres.
  let user = existing;

  if (user) {
    await authStore.setPasswordHash(user.id, passwordHash);
    await authStore.setUserName(user.id, name);
    await authStore.markEmailVerified(user.id);
  } else {
    user = await authStore.createUser({
      name,
      email: invitation.email,
      passwordHash,
      emailVerified: true,
    });
  }

  // De plaats in het abonnement werd bij het uitnodigen al geteld. Een plan
  // dat intussen kleiner werd, houdt een collega die al uitgenodigd is niet
  // buiten: dat is een gesprek voor de facturatiepagina, niet voor deze deur.
  await authStore.createMembership({
    userId: user.id,
    organisationId: organisation.id,
    role: invitation.role,
  });

  await teamStore.markInvitationAccepted(invitation.id);
  await createSession(user.id);

  revalidateTeam();

  redirect(AFTER_LOGIN_ROUTE);
}

