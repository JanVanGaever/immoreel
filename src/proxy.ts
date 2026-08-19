import { NextResponse, type NextRequest } from "next/server";
import {
  AFTER_LOGIN_ROUTE,
  AUTH_ROUTES,
  GUEST_ONLY_ROUTES,
  PUBLIC_ROUTES,
  REDIRECT_PARAM,
  SESSION_COOKIE,
  getAuthSecret,
  safeRedirectPath,
} from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/tokens";

/**
 * Poortwachter voor het hele domein: zonder geldig sessiecookie kom je niet
 * op een privépagina, met sessie niet meer op het inlogscherm.
 *
 * Dit is de `proxy` van Next 16 (voorheen `middleware`). Ze controleert alleen
 * de handtekening en de vervaldatum van het token — snel, en zonder de
 * databank aan te raken. De echte autorisatie (bestaat de gebruiker nog, welke
 * rol heeft die?) gebeurt in de layout en de serveracties via
 * `requireSession()`. Twee sloten op dezelfde deur.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    getAuthSecret(),
  );

  if (!session && !isPublic) {
    const url = new URL(AUTH_ROUTES.login, request.url);
    const target = safeRedirectPath(`${pathname}${search}`);
    if (target) url.searchParams.set(REDIRECT_PARAM, target);

    const response = NextResponse.redirect(url);
    // Ruim een verlopen of vervalst cookie meteen op.
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);

    return response;
  }

  if (session && GUEST_ONLY_ROUTES.includes(pathname)) {
    const target = safeRedirectPath(request.nextUrl.searchParams.get(REDIRECT_PARAM));

    return NextResponse.redirect(new URL(target ?? AFTER_LOGIN_ROUTE, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Alles behalve de API, de statische bestanden van Next en losse assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
