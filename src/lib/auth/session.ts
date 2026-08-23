import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthStore } from "@/db/auth-store";
import {
  AFTER_LOGIN_ROUTE,
  AUTH_ROUTES,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  getAuthSecret,
} from "@/lib/auth/config";
import { can, type Permission } from "@/lib/auth/roles";
import { createSessionId, signSessionToken, verifySessionToken } from "@/lib/auth/tokens";
import type { ID, Organisation, Role, User } from "@/types";

/**
 * De sessie zoals de rest van de app ze ziet: altijd een gebruiker én de
 * organisatie waarin die werkt. Rol en organisatie komen bij elk verzoek uit
 * de store, niet uit het cookie: een verlaagde rol werkt zo meteen door.
 *
 * Alleen voor servercomponenten, serveracties en route handlers.
 */
export type Session = {
  user: User;
  organisation: Organisation;
  membershipId: ID;
  role: Role;
};

/**
 * `cache` zorgt dat layout, pagina en acties binnen hetzelfde verzoek samen
 * één keer de store raadplegen.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const payload = await verifySessionToken(
    cookieStore.get(SESSION_COOKIE)?.value,
    getAuthSecret(),
  );
  if (!payload) return null;

  const store = getAuthStore();
  const record = await store.findUserById(payload.uid);
  if (!record) return null;

  const membership = await store.findMembershipByUser(record.id);
  if (!membership) return null;

  const organisation = await store.findOrganisation(membership.organisationId);
  if (!organisation) return null;

  return {
    // Bewust veld voor veld: zo blijft `passwordHash` op de server.
    user: {
      id: record.id,
      email: record.email,
      name: record.name,
      avatarUrl: record.avatarUrl ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    organisation,
    membershipId: membership.id,
    role: membership.role,
  };
});

/**
 * Voor pagina's en layouts die zonder sessie niets te tonen hebben.
 *
 * Wie hier zonder sessie komt maar mét een cookie, gaat eerst langs
 * `/session-expired`. Dat lijkt een omweg en is het niet: de proxy vindt zo'n
 * cookie geldig — ze kijkt alleen naar de handtekening — en stuurt ons vanaf
 * `/login` regelrecht terug naar de pagina die ons zonet wegstuurde. Die route
 * gooit het cookie weg, en pas dán heeft het inlogscherm zin. Een
 * servercomponent mag zelf geen cookies wissen; een route handler wel.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (session) return session;

  const cookieStore = await cookies();

  redirect(cookieStore.has(SESSION_COOKIE) ? AUTH_ROUTES.sessionExpired : AUTH_ROUTES.login);
}

/**
 * Zelfde als `requireSession`, maar controleert ook of de rol het recht heeft.
 * Wie het recht mist, gaat terug naar het dashboard in plaats van een 403 te
 * zien: de pagina bestaat, ze is alleen niet voor deze rol.
 */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await requireSession();
  if (!can(session.role, permission)) redirect(AFTER_LOGIN_ROUTE);

  return session;
}

/** In serveracties: gooit in plaats van te redirecten. */
export async function assertPermission(permission: Permission): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Niet ingelogd.");
  if (!can(session.role, permission)) throw new Error("Onvoldoende rechten.");

  return session;
}

/** Zet het sessiecookie. Alleen aanroepbaar vanuit een actie of route handler. */
export async function createSession(userId: ID): Promise<void> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signSessionToken(
    {
      sid: createSessionId(),
      uid: userId,
      iat: issuedAt,
      exp: issuedAt + SESSION_TTL_SECONDS,
    },
    getAuthSecret(),
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
