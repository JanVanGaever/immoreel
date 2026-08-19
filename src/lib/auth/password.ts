import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Wachtwoordhashing met scrypt uit de standaardbibliotheek: geen extra
 * dependency, en de parameters staan in de hash zelf, zodat ze later
 * verhoogd kunnen worden zonder bestaande wachtwoorden ongeldig te maken.
 *
 * Formaat: `scrypt$N$r$p$salt$key`, beide in base64url.
 *
 * Dit bestand draait alleen op de server (node:crypto).
 */

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PARAMS = { N: 16384, r: 8, p: 1 } as const;

/** Bovengrens tegen misbruik: scrypt op een megabyte-wachtwoord is een DoS. */
export const PASSWORD_MAX_LENGTH = 200;

type ScryptParams = { N: number; r: number; p: number };

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: params.N, r: params.r, p: params.p },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, PARAMS);

  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6) return false;

  const [scheme, rawN, rawR, rawP, rawSalt, rawKey] = parts;
  if (scheme !== "scrypt" || !rawN || !rawR || !rawP || !rawSalt || !rawKey) return false;

  const params = { N: Number(rawN), r: Number(rawR), p: Number(rawP) };
  if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) {
    return false;
  }

  const expected = Buffer.from(rawKey, "base64url");
  const actual = await derive(password, Buffer.from(rawSalt, "base64url"), params);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const DUMMY_SALT = Buffer.alloc(SALT_LENGTH, 7);

/**
 * Doet even lang over niets als `verifyPassword` over een echte controle.
 * Zonder dit verraadt de responstijd of een e-mailadres bestaat.
 */
export async function burnPasswordTime(password: string): Promise<void> {
  await derive(password, DUMMY_SALT, PARAMS);
}
