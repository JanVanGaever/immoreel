/**
 * AWS Signature Version 4.
 *
 * Bewust zelf en geen SDK, om dezelfde reden als bij Mollie
 * (`src/lib/mollie/client.ts`): we gebruiken drie operaties — een object
 * wegschrijven, ophalen en zijn grootte opvragen — en een afhankelijkheid van
 * twintig megabyte zou vooral betekenen dat de foutafhandeling in een vreemde
 * vorm gegoten wordt.
 *
 * Er is hier één ding dat zwaarder weegt dan smaak: **dit is te bewijzen.** AWS
 * publiceert testvectoren voor deze berekening, en die staan in
 * `tests/storage-signature.test.ts`. Een SDK zou ik zonder echte sleutels juist
 * niet kunnen controleren.
 *
 * Alles loopt via Web Crypto, net als `src/lib/auth/tokens.ts`, zodat dit
 * bestand overal draait waar de app draait.
 */

const encoder = new TextEncoder();

export const ALGORITHM = "AWS4-HMAC-SHA256";

/** De hash van een leeg lichaam; komt vaak genoeg voor om hem te onthouden. */
export const EMPTY_PAYLOAD_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export type SignInput = {
  method: string;
  /** Het pad zoals het in de URL staat, al gecodeerd. */
  path: string;
  /** Querystring zonder `?`; leeg als er geen is. */
  query?: string;
  /** Kopregels die meegetekend worden. `host` is verplicht. */
  headers: Record<string, string>;
  /** Hex-SHA256 van het lichaam. */
  payloadHash: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Het moment van ondertekenen; los meegegeven zodat een test hem kan vastzetten. */
  date: Date;
};

export type SignedRequest = {
  /** De kopregels van het verzoek, inclusief `Authorization`. */
  headers: Record<string, string>;
  /** Alleen voor de tests en het naslaan van een mislukte handtekening. */
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
};

/**
 * De vier stappen uit de specificatie, in volgorde: een canonieke vorm van het
 * verzoek, daar een tekenreeks van, een sleutel die per dag en per dienst
 * verschilt, en tot slot de handtekening.
 */
export async function signRequest(input: SignInput): Promise<SignedRequest> {
  const amzDate = toAmzDate(input.date);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;

  // De kopregels die getekend worden. `x-amz-date` hoort er altijd bij; zonder
  // die kop kan de server niet nagaan of dit verzoek van vandaag is.
  const headers: Record<string, string> = { ...input.headers, "x-amz-date": amzDate };

  const canonicalHeaders = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), collapseSpaces(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const signedHeaders = canonicalHeaders.map(([name]) => name).join(";");

  const canonicalRequest = [
    input.method.toUpperCase(),
    input.path,
    input.query ?? "",
    `${canonicalHeaders.map(([name, value]) => `${name}:${value}`).join("\n")}\n`,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey({
    secretAccessKey: input.secretAccessKey,
    dateStamp,
    region: input.region,
    service: input.service,
  });

  const signature = toHex(await hmac(signingKey, stringToSign));

  return {
    headers: {
      ...headers,
      Authorization:
        `${ALGORITHM} Credential=${input.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    canonicalRequest,
    stringToSign,
    signature,
  };
}

/**
 * De ondertekeningssleutel: vier keer HMAC over elkaar heen.
 *
 * Dat ziet er omslachtig uit en is het niet — de sleutel is daardoor gebonden
 * aan één dag, één regio en één dienst. Lekt hij, dan is hij morgen waardeloos.
 */
export async function deriveSigningKey(input: {
  secretAccessKey: string;
  dateStamp: string;
  region: string;
  service: string;
}): Promise<ArrayBuffer> {
  const kDate = await hmac(encoder.encode(`AWS4${input.secretAccessKey}`), input.dateStamp);
  const kRegion = await hmac(kDate, input.region);
  const kService = await hmac(kRegion, input.service);

  return hmac(kService, "aws4_request");
}

/** `20150830T123600Z` — de vorm die in `x-amz-date` hoort. */
export function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const data = typeof value === "string" ? encoder.encode(value) : value;

  return toHex(await crypto.subtle.digest("SHA-256", data as BufferSource));
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Spaties binnenin een kopwaarde tellen als één, en aan de randen niet mee.
 * Staat in de specificatie en is precies het soort detail waar een
 * handtekening stilletjes op stukloopt.
 */
function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
