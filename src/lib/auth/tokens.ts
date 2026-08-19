/**
 * Sessietokens en e-mailtokens.
 *
 * Alles hier loopt via Web Crypto (`crypto.subtle`) en niet via `node:crypto`,
 * zodat zowel de middleware als de serveracties hetzelfde token kunnen lezen.
 */

export type SessionTokenPayload = {
  /** Sessie-id: uniek per aanmelding, handig in logs. */
  sid: string;
  /** Gebruikers-id. Rol en organisatie worden bewust nooit meegedragen: die
   *  kunnen veranderen en worden bij elk verzoek opnieuw opgehaald. */
  uid: string;
  /** Uitgegeven op, in seconden sinds epoch. */
  iat: number;
  /** Verloopt op, in seconden sinds epoch. */
  exp: number;
};

const encoder = new TextEncoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function getKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;

  const key = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  keyCache.set(secret, key);
  return key;
}

/** Payload en handtekening, gescheiden door een punt: `<payload>.<hmac>`. */
export async function signSessionToken(
  payload: SessionTokenPayload,
  secret: string,
): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await getKey(secret), encoder.encode(body));

  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Geeft de payload terug als handtekening én geldigheidsduur kloppen,
 * anders `null`. Gooit nooit: een kapot cookie is gewoon "niet ingelogd".
 */
export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<SessionTokenPayload | null> {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await getKey(secret),
      base64UrlDecode(signature),
      encoder.encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as unknown;
    if (!isSessionTokenPayload(payload)) return null;
    if (payload.exp * 1000 <= Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

function isSessionTokenPayload(value: unknown): value is SessionTokenPayload {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.sid === "string" &&
    typeof candidate.uid === "string" &&
    typeof candidate.iat === "number" &&
    typeof candidate.exp === "number"
  );
}

/** Token voor in een e-maillink: ruim genoeg entropie om niet te raden. */
export function createEmailToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * In de databank bewaren we alleen de hash. Wie de tabel leest, kan daarmee
 * dus geen geldige herstellink maken.
 */
export async function hashEmailToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createSessionId(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
}
