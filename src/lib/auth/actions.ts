"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthStore, normaliseEmail } from "@/db/auth-store";
import type { AuthActionState } from "@/lib/auth/action-state";
import {
  AFTER_LOGIN_ROUTE,
  AUTH_ROUTES,
  MAGIC_LINK_TTL_SECONDS,
  PASSWORD_RESET_TTL_SECONDS,
  getAppUrl,
  safeRedirectPath,
} from "@/lib/auth/config";
import { sendMagicLinkEmail, sendPasswordResetEmail } from "@/lib/auth/email";
import { burnPasswordTime, hashPassword, verifyPassword } from "@/lib/auth/password";
import { EMAIL_RATE_LIMIT, LOGIN_RATE_LIMIT, clearAttempts, consumeAttempt } from "@/lib/auth/rate-limit";
import { createSession, destroySession } from "@/lib/auth/session";
import { createEmailToken, hashEmailToken } from "@/lib/auth/tokens";
import {
  hasErrors,
  readField,
  validateEmail,
  validateName,
  validateOrganisationName,
  validatePassword,
  validatePasswordConfirmation,
  type FieldErrors,
} from "@/lib/auth/validation";

/**
 * Serveracties achter de auth-formulieren.
 *
 * Twee regels lopen door alles heen:
 * 1. Meldingen verraden nooit of een e-mailadres bestaat (behalve bij
 *    registreren, waar dat onvermijdelijk is).
 * 2. Elke actie valideert opnieuw; wat de client stuurt is een suggestie.
 */

async function clientKey(suffix: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerList.get("x-real-ip") || "onbekend";

  return `${ip}:${suffix}`;
}

/**
 * Volledige URL voor in een e-mail. `NEXT_PUBLIC_APP_URL` gaat voor: de
 * Host-header van het verzoek is door een bezoeker te vervalsen, en een
 * herstellink naar een vreemd domein is precies wat je niet wil. Alleen als
 * die variabele ontbreekt (typisch lokaal) vallen we terug op de header.
 */
async function absoluteUrl(path: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return `${configured}${path}`;

  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) return `${getAppUrl()}${path}`;

  return `${headerList.get("x-forwarded-proto") ?? "http"}://${host}${path}`;
}

const GENERIC_CREDENTIALS_ERROR = "E-mailadres of wachtwoord klopt niet.";

/** Zelfde melding of het adres nu bestaat of niet. */
const GENERIC_EMAIL_SENT =
  "Als er een account bij dit adres hoort, is er een e-mail onderweg. Kijk ook even in je spam.";

export async function signUpAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = readField(formData, "name");
  const organisationName = readField(formData, "organisation");
  const email = readField(formData, "email");
  const password = readField(formData, "password");
  const acceptedTerms = formData.get("terms") === "on";

  const values = { name, organisation: organisationName, email };

  const fieldErrors: FieldErrors = {
    name: validateName(name),
    organisation: validateOrganisationName(organisationName),
    email: validateEmail(email),
    password: validatePassword(password),
    terms: acceptedTerms ? undefined : "Ga akkoord om verder te gaan.",
  };

  if (hasErrors(fieldErrors)) {
    return { status: "error", fieldErrors, values };
  }

  const rate = consumeAttempt(await clientKey("signup"), EMAIL_RATE_LIMIT);
  if (!rate.allowed) {
    return {
      status: "error",
      message: "Te veel registraties vanaf dit adres. Probeer het straks opnieuw.",
      values,
    };
  }

  const store = getAuthStore();
  const existing = await store.findUserByEmail(email);

  if (existing) {
    return {
      status: "error",
      fieldErrors: { email: "Er bestaat al een account met dit e-mailadres." },
      values,
    };
  }

  const { user } = await store.createAccount({
    name,
    email: normaliseEmail(email),
    passwordHash: await hashPassword(password),
    // De organisatie wordt meteen mee aangemaakt: een gebruiker zonder
    // organisatie bestaat niet in Immoreel.
    organisationName,
  });

  await createSession(user.id);

  redirect(AFTER_LOGIN_ROUTE);
}

export async function signInAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readField(formData, "email");
  const password = readField(formData, "password");
  const values = { email };

  const fieldErrors: FieldErrors = {
    email: validateEmail(email),
    password: password ? undefined : "Vul je wachtwoord in.",
  };

  if (hasErrors(fieldErrors)) {
    return { status: "error", fieldErrors, values };
  }

  const rateKey = await clientKey(`login:${normaliseEmail(email)}`);
  const rate = consumeAttempt(rateKey, LOGIN_RATE_LIMIT);

  if (!rate.allowed) {
    return {
      status: "error",
      message: `Te veel pogingen. Probeer het over ${Math.ceil(rate.retryAfterSeconds / 60)} minuten opnieuw.`,
      values,
    };
  }

  const user = await getAuthStore().findUserByEmail(email);

  if (!user) {
    // Even lang rekenen als bij een bestaand account, anders verraadt de
    // responstijd welke adressen geregistreerd zijn.
    await burnPasswordTime(password);
    return { status: "error", message: GENERIC_CREDENTIALS_ERROR, values };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return { status: "error", message: GENERIC_CREDENTIALS_ERROR, values };
  }

  clearAttempts(rateKey);
  await createSession(user.id);

  redirect(safeRedirectPath(readField(formData, "redirectTo")) ?? AFTER_LOGIN_ROUTE);
}

export async function requestPasswordResetAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readField(formData, "email");
  const emailError = validateEmail(email);

  if (emailError) {
    return { status: "error", fieldErrors: { email: emailError }, values: { email } };
  }

  const rate = consumeAttempt(await clientKey(`reset:${normaliseEmail(email)}`), EMAIL_RATE_LIMIT);
  if (!rate.allowed) {
    return {
      status: "error",
      message: "Te veel aanvragen. Probeer het straks opnieuw.",
      values: { email },
    };
  }

  const store = getAuthStore();
  const user = await store.findUserByEmail(email);

  if (user) {
    await store.revokeAuthTokens(user.id, "password-reset");

    const token = createEmailToken();
    await store.createAuthToken({
      userId: user.id,
      purpose: "password-reset",
      tokenHash: await hashEmailToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000),
    });

    await sendPasswordResetEmail(
      user.email,
      await absoluteUrl(`${AUTH_ROUTES.resetPassword}?token=${token}`),
    );
  }

  return { status: "success", message: GENERIC_EMAIL_SENT, values: { email } };
}

export async function resetPasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = readField(formData, "token");
  const password = readField(formData, "password");
  const confirmation = readField(formData, "passwordConfirmation");

  const fieldErrors: FieldErrors = {
    password: validatePassword(password),
    passwordConfirmation: validatePasswordConfirmation(password, confirmation),
  };

  if (hasErrors(fieldErrors)) {
    return { status: "error", fieldErrors };
  }

  if (!token) {
    return { status: "error", message: "Deze link is onvolledig. Vraag een nieuwe aan." };
  }

  const store = getAuthStore();
  const authToken = await store.consumeAuthToken("password-reset", await hashEmailToken(token));

  if (!authToken) {
    return {
      status: "error",
      message: "Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.",
    };
  }

  await store.setPasswordHash(authToken.userId, await hashPassword(password));
  // Wie het wachtwoord reset, bewijst dat hij bij de mailbox kan.
  await store.markEmailVerified(authToken.userId);
  await store.revokeAuthTokens(authToken.userId, "password-reset");
  await store.revokeAuthTokens(authToken.userId, "magic-link");

  await createSession(authToken.userId);

  redirect(AFTER_LOGIN_ROUTE);
}

export async function requestMagicLinkAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readField(formData, "email");
  const emailError = validateEmail(email);

  if (emailError) {
    return { status: "error", fieldErrors: { email: emailError }, values: { email } };
  }

  const rate = consumeAttempt(await clientKey(`magic:${normaliseEmail(email)}`), EMAIL_RATE_LIMIT);
  if (!rate.allowed) {
    return {
      status: "error",
      message: "Te veel aanvragen. Probeer het straks opnieuw.",
      values: { email },
    };
  }

  const store = getAuthStore();
  const user = await store.findUserByEmail(email);

  if (user) {
    await store.revokeAuthTokens(user.id, "magic-link");

    const token = createEmailToken();
    await store.createAuthToken({
      userId: user.id,
      purpose: "magic-link",
      tokenHash: await hashEmailToken(token),
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000),
    });

    await sendMagicLinkEmail(
      user.email,
      await absoluteUrl(`${AUTH_ROUTES.magicLink}?token=${token}`),
    );
  }

  return { status: "success", message: GENERIC_EMAIL_SENT, values: { email } };
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect(AUTH_ROUTES.login);
}
