import { NextResponse, type NextRequest } from "next/server";
import { getAuthStore } from "@/db/auth-store";
import { AFTER_LOGIN_ROUTE, AUTH_ROUTES } from "@/lib/auth/config";
import { createSession } from "@/lib/auth/session";
import { hashEmailToken } from "@/lib/auth/tokens";

/**
 * Landingsplek van de magic link uit de e-mail: token inruilen voor een sessie.
 *
 * Het token wordt hier meteen verbruikt. Dat is eenvoudig, maar sommige
 * mailscanners openen links vooraf; dan is de link "op" voor de gebruiker hem
 * aanklikt. TODO: bij een echte e-mailprovider hier een tussenpagina met een
 * bevestigingsknop (POST) zetten.
 */
export async function GET(request: NextRequest) {
  const invalid = new URL(`${AUTH_ROUTES.login}?melding=magic-link-ongeldig`, request.url);
  const token = request.nextUrl.searchParams.get("token");

  if (!token) return NextResponse.redirect(invalid);

  const store = getAuthStore();
  const authToken = await store.consumeAuthToken("magic-link", await hashEmailToken(token));

  if (!authToken) return NextResponse.redirect(invalid);

  // Wie op de link klikt, bewijst dat hij bij de mailbox kan.
  await store.markEmailVerified(authToken.userId);
  await createSession(authToken.userId);

  return NextResponse.redirect(new URL(AFTER_LOGIN_ROUTE, request.url));
}
