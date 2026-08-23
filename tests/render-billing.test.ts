import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, getAuthSecret } from "../src/lib/auth/config";
import { signSessionToken } from "../src/lib/auth/tokens";
import { hasBillingAccess } from "../src/lib/billing/status";
import { statusFor } from "../src/lib/errors/catalogue";
import type { SubscriptionStatus } from "../src/types/billing";

/**
 * Renderen is de dienst waarvoor betaald wordt.
 *
 * Vóór deze tests kon een kantoor waarvan het abonnement opgezegd was gewoon
 * blijven exporteren en downloaden: `hasBillingAccess()` bestond, maar werd
 * alleen gebruikt om een veldje in `GET /api/billing/status` te vullen. De poort
 * staat nu in `startRenders()` — de enige plek waar een render begint.
 */

describe("wie mag renderen", () => {
  /**
   * Alle vijf de statussen staan er met naam bij. Dat is expres: `achterstallig`
   * hoort erdoor te mogen, en dat is een productkeuze die iemand die deze regel
   * later leest niet per ongeluk mag "opruimen". Zie `hasBillingAccess()`.
   */
  const VERWACHT: Record<SubscriptionStatus, boolean> = {
    proef: true,
    wachtend: true,
    actief: true,
    achterstallig: true,
    opgezegd: false,
  };

  for (const [status, toegestaan] of Object.entries(VERWACHT)) {
    it(`${status}: ${toegestaan ? "mag renderen" : "mag niet renderen"}`, () => {
      assert.equal(hasBillingAccess(status as SubscriptionStatus), toegestaan);
    });
  }

  it("laat een achterstallige betaling de dienst niet stilleggen", () => {
    assert.ok(
      hasBillingAccess("achterstallig"),
      "een geweigerde kaart mag geen reden zijn om iemand midden in zijn werk stil te leggen",
    );
  });
});

describe("de weigering zelf", () => {
  /** 402 en geen 403: dit gaat over het abonnement, niet over iemands rol. */
  it("is een 402 Payment Required", () => {
    assert.equal(statusFor("subscription-required"), 402);
  });

  it("is iets anders dan onvoldoende rechten", () => {
    assert.notEqual(statusFor("subscription-required"), statusFor("forbidden"));
  });
});

/* -------------------------------------------------------------------------
 * Tegen een draaiende server
 * ---------------------------------------------------------------------- */

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3010";

/** Het demokantoor uit `src/db/seed/` staat op `actief`. */
const SEED = {
  owner: "usr_demo",
  viewer: "usr_demo_viewer",
  project: "prj_demo_leiestraat",
} as const;

async function sessionCookie(userId: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signSessionToken(
    { sid: "test-sessie", uid: userId, iat: issuedAt, exp: issuedAt + SESSION_TTL_SECONDS },
    getAuthSecret(),
  );

  return `${SESSION_COOKIE}=${token}`;
}

async function startRender(userId: string) {
  const response = await fetch(`${BASE_URL}/api/projects/${SEED.project}/renders`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", cookie: await sessionCookie(userId) },
    body: JSON.stringify({ presetIds: ["instagram-reel"] }),
  });

  const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;

  return { status: response.status, code: body?.error?.code ?? null };
}

async function serverIsUp(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}/login`, { redirect: "manual" });

    return true;
  } catch {
    return false;
  }
}

describe("POST /api/projects/:id/renders", { concurrency: false }, async () => {
  if (!(await serverIsUp())) {
    it("overgeslagen: geen server", { skip: `Geen server op ${BASE_URL}.` }, () => {});

    return;
  }

  /**
   * De belangrijkste kant van deze fix: hij mag geen klant buitensluiten die
   * gewoon betaalt. Het demokantoor staat op `actief`, dus wat er ook terugkomt,
   * het is geen 402.
   */
  it("laat een betalend kantoor door de poort", async () => {
    const { status, code } = await startRender(SEED.owner);

    assert.notEqual(status, 402, "een actief abonnement werd geweigerd");
    assert.notEqual(code, "subscription-required");
  });

  /** Rechten gaan vóór facturatie: een kijker hoort geen betaalmelding te zien. */
  it("weigert een kijker op rechten, niet op facturatie", async () => {
    const { status, code } = await startRender(SEED.viewer);

    assert.equal(status, 403);
    assert.equal(code, "forbidden");
  });
});
