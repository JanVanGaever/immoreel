import { forbidden, unauthenticated } from "@/lib/api/errors";
import { can, type Permission } from "@/lib/auth/roles";
import { getSession, type Session } from "@/lib/auth/session";

/**
 * De sessie voor een route handler.
 *
 * `requireSession()` en `requirePermission()` uit `lib/auth/session.ts` sturen
 * de bezoeker door naar het inlogscherm. Dat is precies goed voor een pagina en
 * precies fout voor een API: een `fetch` die een redirect naar HTML volgt,
 * krijgt geen bruikbaar antwoord maar een inlogpagina met code 200. Hier hoort
 * een 401 of een 403, en dat is het enige verschil met de paginaversie.
 *
 * `assertPermission()` gooit wél, maar een kale `Error` — dat wordt een 500 en
 * dus een fout van ons in plaats van een verzoek zonder rechten.
 */
export async function requireApiSession(permission: Permission): Promise<Session> {
  const session = await getSession();
  if (!session) throw unauthenticated();
  if (!can(session.role, permission)) throw forbidden();

  return session;
}
