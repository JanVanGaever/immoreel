import { NextResponse, type NextRequest } from "next/server";
import { getAuthStore } from "@/db/auth-store";
import { AUTH_ROUTES } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { hashEmailToken } from "@/lib/auth/tokens";
import { ROUTES } from "@/lib/constants";

/**
 * Landingsplek van de bevestigingslink uit de mail: hier wisselt het
 * e-mailadres écht.
 *
 * De link werkt ook zonder sessie — de mail kan in een andere browser geopend
 * worden — want het token is het bewijs, niet het cookie. Wie ingelogd is,
 * komt terug op zijn accountpagina; wie niet, op het inlogscherm met het
 * nieuwe adres al bevestigd.
 *
 * Net als bij de magic link wordt het token meteen verbruikt. Zie de TODO
 * daar: met een echte mailprovider hoort hier een tussenpagina met een knop,
 * want sommige mailscanners openen links vooraf.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  const target = (melding: string) =>
    new URL(
      session ? `${ROUTES.account}?melding=${melding}` : `${AUTH_ROUTES.login}?melding=${melding}`,
      request.url,
    );

  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(target("e-mail-link-ongeldig"));

  const store = getAuthStore();
  const authToken = await store.consumeAuthToken("email-change", await hashEmailToken(token));

  if (!authToken?.email) return NextResponse.redirect(target("e-mail-link-ongeldig"));

  // Tussen aanvragen en klikken kan iemand anders dit adres genomen hebben.
  // Het token is dan verbruikt en de gebruiker vraagt gewoon opnieuw aan —
  // beter dan twee accounts met hetzelfde adres.
  const bezet = await store.findUserByEmail(authToken.email);
  if (bezet && bezet.id !== authToken.userId) {
    return NextResponse.redirect(target("e-mail-bezet"));
  }

  await store.setUserEmail(authToken.userId, authToken.email);

  return NextResponse.redirect(target("e-mailadres-gewijzigd"));
}
