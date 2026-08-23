import { NextResponse, type NextRequest } from "next/server";
import { AFTER_LOGIN_ROUTE, AUTH_ROUTES } from "@/lib/auth/config";
import { destroySession, getSession } from "@/lib/auth/session";

/**
 * Een sessiecookie opruimen dat nergens meer naar wijst.
 *
 * Er zijn twee meningen over "ben je ingelogd" en ze kunnen uit elkaar lopen.
 * `src/proxy.ts` kijkt alleen naar de handtekening en de vervaldatum van het
 * cookie — snel, en zonder de store aan te raken. `requireSession()` kijkt of
 * de gebruiker er nog is. Meestal zeggen ze hetzelfde. Zeggen ze het niet, dan
 * stuurt de layout je naar `/login`, ziet de proxy daar een geldig cookie, en
 * stuurt hij je terug naar het dashboard — waar de layout je weer wegstuurt.
 * Dat is geen theoretisch geval: elke herstart van de server leegt de stores
 * (ze draaien in het geheugen) terwijl de cookies dertig dagen geldig blijven,
 * en dan zit iedereen die ingelogd was vast in die lus.
 *
 * Deze route is de uitweg. Een route handler mag wél cookies wissen, een
 * servercomponent niet — vandaar de omweg langs een aparte URL in plaats van
 * het cookie meteen in de layout weg te gooien.
 *
 * Ze wist alleen wat kapot is. Een sessie die het gewoon doet, gaat ongemoeid
 * terug naar het dashboard: anders zou `<img src="/session-expired">` op een
 * vreemde site genoeg zijn om iemand uit te loggen.
 */
export async function GET(request: NextRequest) {
  // Zelfde controle als de layout doet: bestaat de gebruiker achter dit cookie?
  if (await getSession()) {
    return NextResponse.redirect(new URL(AFTER_LOGIN_ROUTE, request.url));
  }

  await destroySession();

  return NextResponse.redirect(
    new URL(`${AUTH_ROUTES.login}?melding=sessie-verlopen`, request.url),
  );
}
