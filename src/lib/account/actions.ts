"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountStore } from "@/db/account-store";
import { getAuthStore, normaliseEmail } from "@/db/auth-store";
import { getBillingStore } from "@/db/billing-store";
import { getNotificationStore } from "@/db/notification-store";
import { getTeamStore } from "@/db/team-store";
import type { AccountActionState } from "@/lib/account/action-state";
import { findLocale, normalisePreferences } from "@/lib/account/preferences";
import { checkAccountDeletion, deletionConfirmationMatches } from "@/lib/account/rules";
import { AUTH_ROUTES, EMAIL_CHANGE_TTL_SECONDS } from "@/lib/auth/config";
import {
  sendEmailChangeConfirmation,
  sendEmailChangeNotice,
  sendPasswordChangedNotice,
} from "@/lib/auth/email";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { EMAIL_RATE_LIMIT, LOGIN_RATE_LIMIT, consumeAttempt } from "@/lib/auth/rate-limit";
import { absoluteUrl, clientKey } from "@/lib/auth/request";
import { destroySession, getSession, type Session } from "@/lib/auth/session";
import { createEmailToken, hashEmailToken } from "@/lib/auth/tokens";
import {
  hasErrors,
  readField,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
  type FieldErrors,
} from "@/lib/auth/validation";
import { countOwners } from "@/lib/team/rules";
import { ROUTES } from "@/lib/constants";
import type { UserPreferencesInput } from "@/types";

/**
 * De serveracties achter de accountpagina.
 *
 * Er is geen recht voor nodig: dit is je eigen account, en iedereen die
 * ingelogd is, mag het beheren. Wat er wél doorheen loopt:
 *
 * 1. **Gevoelige wijzigingen vragen je wachtwoord opnieuw.** Een openstaand
 *    tabblad op een gedeelde computer is genoeg om een e-mailadres te kapen;
 *    het wachtwoord is wat een sessie niet bewijst.
 * 2. **Een nieuw e-mailadres wordt pas van jou als je het bevestigt.** Tot dan
 *    verandert er niets aan je account — zie `requestEmailChangeAction`.
 * 3. **Wat de client stuurt is een suggestie.** Alles wordt hier opnieuw
 *    gevalideerd en genormaliseerd.
 */

function fout(message: string, extra?: Partial<AccountActionState>): AccountActionState {
  return { status: "fout", message, ...extra };
}

function gelukt(message: string, extra?: Partial<AccountActionState>): AccountActionState {
  return { status: "gelukt", message, ...extra };
}

/** Je eigen account beheren vraagt geen recht, alleen een sessie. */
async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Niet ingelogd.");

  return session;
}

function revalidateAccount(): void {
  revalidatePath(ROUTES.account);
  revalidatePath(ROUTES.settings);
  // De naam staat in de topbar, en die zit in de layout van elke pagina.
  revalidatePath(ROUTES.dashboard);
}

/**
 * Het wachtwoord opnieuw vragen bij een gevoelige handeling.
 *
 * Wie nog geen wachtwoord heeft — binnengekomen via een magic link — kan er
 * ook geen geven. Die valt terug op de sessie zelf; dat is dezelfde toegang
 * als waarmee hij zou inloggen, dus er valt niets extra te bewijzen.
 */
async function confirmPassword(
  session: Session,
  password: string,
  field: string,
): Promise<FieldErrors | null> {
  const record = await getAuthStore().findUserById(session.user.id);
  if (!record?.passwordHash) return null;

  if (!password) return { [field]: "Vul je huidige wachtwoord in." };

  const rate = consumeAttempt(await clientKey(`account:${session.user.id}`), LOGIN_RATE_LIMIT);
  if (!rate.allowed) {
    return {
      [field]: `Te veel pogingen. Probeer het over ${Math.ceil(rate.retryAfterSeconds / 60)} minuten opnieuw.`,
    };
  }

  if (!(await verifyPassword(password, record.passwordHash))) {
    return { [field]: "Dit wachtwoord klopt niet." };
  }

  return null;
}

/* -------------------------------------------------------------------------
 * Profiel
 * ---------------------------------------------------------------------- */

export async function updateNameAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await requireUser();
  const name = readField(formData, "name");

  const nameError = validateName(name);
  if (nameError) {
    return { status: "fout", fieldErrors: { name: nameError }, values: { name } };
  }

  if (name.trim() === session.user.name) {
    return gelukt("Je naam stond al zo.", { values: { name } });
  }

  await getAuthStore().setUserName(session.user.id, name);
  revalidateAccount();

  return gelukt("Je naam is aangepast.", { values: { name: name.trim() } });
}

/* -------------------------------------------------------------------------
 * E-mailadres
 * ---------------------------------------------------------------------- */

/**
 * Een nieuw e-mailadres aanvragen.
 *
 * Het adres verandert hier nog niet. Er gaat een bevestigingslink naar het
 * nieuwe adres en een waarschuwing naar het oude; pas wie op die link klikt,
 * bewijst dat de mailbox van hem is. Zou het adres meteen wisselen, dan is één
 * typfout genoeg om jezelf buiten te sluiten — het is immers ook je login.
 */
export async function requestEmailChangeAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await requireUser();

  const email = readField(formData, "email");
  const password = readField(formData, "password");
  const values = { email };

  const emailError = validateEmail(email);
  if (emailError) {
    return { status: "fout", fieldErrors: { email: emailError }, values };
  }

  const wanted = normaliseEmail(email);
  if (wanted === session.user.email) {
    return {
      status: "fout",
      fieldErrors: { email: "Dit is al je huidige e-mailadres." },
      values,
    };
  }

  const passwordErrors = await confirmPassword(session, password, "password");
  if (passwordErrors) return { status: "fout", fieldErrors: passwordErrors, values };

  const store = getAuthStore();

  // Bezet door iemand anders? Dat zeggen we gewoon: het gaat om een adres dat
  // de gebruiker zelf aanbrengt, niet om een lijst die hij kan aflopen.
  if (await store.findUserByEmail(wanted)) {
    return {
      status: "fout",
      fieldErrors: { email: "Er bestaat al een account met dit e-mailadres." },
      values,
    };
  }

  const rate = consumeAttempt(await clientKey(`email-change:${session.user.id}`), EMAIL_RATE_LIMIT);
  if (!rate.allowed) {
    return fout("Te veel aanvragen na elkaar. Probeer het straks opnieuw.", { values });
  }

  // Er is er altijd maar één onderweg: een vorige aanvraag vervalt.
  await store.revokeAuthTokens(session.user.id, "email-change");

  const token = createEmailToken();
  await store.createAuthToken({
    userId: session.user.id,
    purpose: "email-change",
    tokenHash: await hashEmailToken(token),
    email: wanted,
    expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_SECONDS * 1000),
  });

  const confirmUrl = await absoluteUrl(
    `${AUTH_ROUTES.emailChange}?token=${encodeURIComponent(token)}`,
  );

  let emailDelivered = true;
  try {
    await sendEmailChangeConfirmation(wanted, confirmUrl);
    // De waarschuwing naar het oude adres mag de aanvraag niet tegenhouden,
    // maar ze hoort er wel te zijn: het is het vangnet van wie zijn account
    // kwijtraakt.
    await sendEmailChangeNotice(session.user.email, wanted);
  } catch {
    emailDelivered = false;
  }

  revalidateAccount();

  return gelukt(
    emailDelivered
      ? `We stuurden een bevestiging naar ${wanted}. Je adres verandert pas als je erop klikt.`
      : `De aanvraag staat klaar voor ${wanted}, maar de e-mail kon niet verstuurd worden. Open de link hieronder zelf.`,
    { confirmUrl, emailDelivered, values: { email: wanted } },
  );
}

export async function cancelEmailChangeAction(): Promise<AccountActionState> {
  const session = await requireUser();

  await getAuthStore().revokeAuthTokens(session.user.id, "email-change");
  revalidateAccount();

  return gelukt("De aanvraag is ingetrokken. Je e-mailadres blijft wat het was.");
}

/* -------------------------------------------------------------------------
 * Wachtwoord
 * ---------------------------------------------------------------------- */

export async function changePasswordAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await requireUser();

  const current = readField(formData, "currentPassword");
  const password = readField(formData, "password");
  const confirmation = readField(formData, "passwordConfirmation");

  const fieldErrors: FieldErrors = {
    password: validatePassword(password),
    passwordConfirmation: validatePasswordConfirmation(password, confirmation),
  };

  if (hasErrors(fieldErrors)) return { status: "fout", fieldErrors };

  const passwordErrors = await confirmPassword(session, current, "currentPassword");
  if (passwordErrors) return { status: "fout", fieldErrors: passwordErrors };

  if (current && current === password) {
    return {
      status: "fout",
      fieldErrors: { password: "Kies een ander wachtwoord dan je huidige." },
    };
  }

  const store = getAuthStore();
  await store.setPasswordHash(session.user.id, await hashPassword(password));

  // Openstaande herstel- en inloglinks horen niet meer te werken: wie het
  // wachtwoord wijzigt, sluit ook de deuren die hij eerder openzette.
  await store.revokeAuthTokens(session.user.id, "password-reset");
  await store.revokeAuthTokens(session.user.id, "magic-link");

  try {
    await sendPasswordChangedNotice(session.user.email);
  } catch {
    // Een niet-verstuurde bevestiging maakt het wachtwoord niet minder gewijzigd.
  }

  revalidateAccount();

  return gelukt("Je wachtwoord is aangepast.");
}

/* -------------------------------------------------------------------------
 * Voorkeuren
 * ---------------------------------------------------------------------- */

export async function savePreferencesAction(
  input: UserPreferencesInput,
): Promise<AccountActionState> {
  const session = await requireUser();

  const preferences = await getAccountStore().savePreferences(
    session.user.id,
    normalisePreferences(input),
  );

  revalidateAccount();

  return gelukt(`Je voorkeuren zijn bewaard. Taal: ${findLocale(preferences.locale).label}.`);
}

/* -------------------------------------------------------------------------
 * Account verwijderen
 * ---------------------------------------------------------------------- */

export async function deleteAccountAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const session = await requireUser();

  const confirmation = readField(formData, "confirmation");
  const password = readField(formData, "password");

  if (!deletionConfirmationMatches(session.user.email, confirmation)) {
    return {
      status: "fout",
      fieldErrors: { confirmation: "Typ je e-mailadres exact over om te bevestigen." },
    };
  }

  const passwordErrors = await confirmPassword(session, password, "password");
  if (passwordErrors) return { status: "fout", fieldErrors: passwordErrors };

  const teamStore = getTeamStore();
  const [members, subscription] = await Promise.all([
    teamStore.listMembers(session.organisation.id),
    getBillingStore().getSubscription(session.organisation.id),
  ]);

  const context = {
    role: session.role,
    otherMembers: members.filter((member) => member.membershipId !== session.membershipId).length,
    owners: countOwners(members),
    subscriptionStatus: subscription.status,
  };

  const check = checkAccountDeletion(context);
  if (!check.allowed) return fout(check.reason ?? "Verwijderen kan niet.");

  const store = getAuthStore();

  await getAccountStore().deletePreferences(session.user.id);
  await getNotificationStore().deleteForUser(session.user.id);
  await store.deleteAccount(session.user.id);

  // Was jij de laatste, dan blijft er een kantoor zonder mensen achter. Dat
  // verdwijnt mee.
  //
  // TODO: de projecten, renders, huisstijl en facturen van dat kantoor blijven
  // voorlopig staan — hun stores kennen geen verwijderen. Met de databank
  // hoort dit één `ON DELETE CASCADE` te zijn.
  if (context.otherMembers === 0) {
    await store.deleteOrganisation(session.organisation.id);
  }

  await destroySession();

  redirect(`${AUTH_ROUTES.login}?melding=account-verwijderd`);
}
