import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  AFTER_LOGIN_ROUTE,
  AUTH_ROUTES,
  GUEST_ONLY_ROUTES,
  PUBLIC_ROUTES,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  getAuthSecret,
  safeRedirectPath,
} from "../src/lib/auth/config";
import { signSessionToken } from "../src/lib/auth/tokens";

/**
 * De redirectlus tussen de proxy en de layout.
 *
 * Een sessiecookie is ondertekend en dertig dagen geldig; de gebruiker
 * erachter leeft in een `Map` die elke herstart leegloopt. Dan vindt
 * `src/proxy.ts` je ingelogd (ze kijkt alleen naar de handtekening) en vindt
 * `requireSession()` van niet. `/dashboard` stuurt je naar `/login`, `/login`
 * stuurt je terug naar `/dashboard`, en dat gaat door tot de browser opgeeft
 * met ERR_TOO_MANY_REDIRECTS. Voor de gebruiker: een wit scherm.
 *
 * Deze tests staan er om die lus niet opnieuw uit te vinden.
 */

describe("routetabel", () => {
  /**
   * De kern. `/session-expired` moet bereikbaar zijn mét cookie — dat is het
   * hele punt, want alleen wie een cookie heeft valt op te ruimen. Belandt deze
   * route ooit tussen de gastroutes, dan stuurt de proxy hem weg zodra er een
   * cookie ligt en is de lus meteen terug.
   */
  it("laat /session-expired ook toe wanneer er een cookie ligt", () => {
    assert.ok(
      !GUEST_ONLY_ROUTES.includes(AUTH_ROUTES.sessionExpired),
      "/session-expired mag nooit guest-only zijn: dan kan het cookie dat de lus veroorzaakt nooit opgeruimd worden",
    );
  });

  it("kent /session-expired als publieke route", () => {
    assert.ok(PUBLIC_ROUTES.includes(AUTH_ROUTES.sessionExpired));
  });

  /** Zonder dit werd de voordeur `/login?redirectTo=%2F` in plaats van `/login`. */
  it("kent / als publieke route", () => {
    assert.ok(PUBLIC_ROUTES.includes("/"));
  });

  it("stuurt niemand na het inloggen terug naar een auth-scherm", () => {
    for (const route of PUBLIC_ROUTES) {
      assert.equal(safeRedirectPath(route), null, `${route} hoort geen bestemming te zijn`);
    }
  });

  it("weert een open redirect naar een ander domein", () => {
    assert.equal(safeRedirectPath("https://phish.example"), null);
    assert.equal(safeRedirectPath("//phish.example"), null);
    assert.equal(safeRedirectPath("/\\phish.example"), null);
    assert.equal(safeRedirectPath("/projects/prj_123"), "/projects/prj_123");
  });
});

/* -------------------------------------------------------------------------
 * Tegen een draaiende server
 * ---------------------------------------------------------------------- */

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3010";

/** Een geldig ondertekend cookie voor een gebruiker die niet bestaat. */
async function orphanSessionCookie(): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signSessionToken(
    {
      sid: "test-sessie",
      uid: "usr_bestaat_niet",
      iat: issuedAt,
      exp: issuedAt + SESSION_TTL_SECONDS,
    },
    getAuthSecret(),
  );

  return `${SESSION_COOKIE}=${token}`;
}

async function serverIsUp(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}${AUTH_ROUTES.login}`, { redirect: "manual" });

    return true;
  } catch {
    return false;
  }
}

/** Volgt redirects met de hand, zodat we ze kunnen tellen in plaats van erin te verdwalen. */
async function followRedirects(path: string, cookie: string, max = 10) {
  const hops: string[] = [];
  let url = new URL(path, BASE_URL);
  let currentCookie = cookie;
  let cookieCleared = false;

  for (let step = 0; step < max; step += 1) {
    const response: Response = await fetch(url, {
      redirect: "manual",
      headers: { cookie: currentCookie },
    });

    // Het cookie wissen is een Set-Cookie met een lege waarde of een datum in
    // het verleden; beide vormen komen voor.
    const setCookie = response.headers.get("set-cookie") ?? "";
    if (setCookie.includes(SESSION_COOKIE)) {
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970|immoreel_session=;/i.test(setCookie)) {
        cookieCleared = true;
        currentCookie = "";
      }
    }

    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return { hops, cookieCleared, finalPath: url.pathname, status: response.status };
    }

    url = new URL(location, BASE_URL);
    hops.push(url.pathname);
  }

  return { hops, cookieCleared, finalPath: url.pathname, status: 0, exhausted: true };
}

describe("een cookie zonder gebruiker erachter", { concurrency: false }, async () => {
  const up = await serverIsUp();

  if (!up) {
    it("overgeslagen: geen server", { skip: `Geen server op ${BASE_URL}. Start 'npm run dev'.` }, () => {});

    return;
  }

  it("loopt niet in een redirectlus op /dashboard", async () => {
    const result = await followRedirects("/dashboard", await orphanSessionCookie());

    assert.ok(
      !result.exhausted,
      `redirectlus: ${result.hops.join(" -> ")}`,
    );
    assert.ok(
      result.hops.length <= 3,
      `te veel hops (${result.hops.length}): ${result.hops.join(" -> ")}`,
    );
  });

  it("ruimt het cookie op en zet je op het inlogscherm", async () => {
    const result = await followRedirects("/dashboard", await orphanSessionCookie());

    assert.equal(result.finalPath, AUTH_ROUTES.login, `geëindigd op ${result.finalPath}`);
    assert.ok(result.cookieCleared, "het weescookie is niet gewist; de volgende klik lust opnieuw");
    assert.equal(result.status, 200);
  });

  it("laat de voordeur met rust voor wie niet ingelogd is", async () => {
    const result = await followRedirects("/", "");

    assert.ok(!result.exhausted, `redirectlus: ${result.hops.join(" -> ")}`);
    assert.equal(result.finalPath, AUTH_ROUTES.login);
  });

  after(() => {
    // Niets op te ruimen: deze tests maken geen accounts aan, ze verzinnen
    // alleen een cookie voor een gebruiker die nooit bestaan heeft.
  });
});

describe("een geldige sessie", { concurrency: false }, () => {
  /**
   * `/session-expired` wist alleen wat kapot is. Zou ze elke sessie wissen, dan
   * was `<img src="/session-expired">` op een vreemde site genoeg om iemand uit
   * te loggen.
   */
  it("wordt niet uitgelogd door /session-expired", async () => {
    if (!(await serverIsUp())) return;

    const response = await fetch(`${BASE_URL}${AUTH_ROUTES.sessionExpired}`, {
      redirect: "manual",
      headers: { cookie: "" },
    });

    // Zonder cookie valt er niets te wissen; wie er wél een heeft en geldig is,
    // gaat naar het dashboard. Beide zijn een redirect, geen 500.
    assert.ok(
      response.status >= 300 && response.status < 400,
      `verwachtte een redirect, kreeg ${response.status}`,
    );
    assert.ok(
      [AUTH_ROUTES.login, AFTER_LOGIN_ROUTE].some((route) =>
        (response.headers.get("location") ?? "").includes(route),
      ),
    );
  });
});
