import { getStorageConfig, objectUrl, type StorageConfig } from "@/lib/storage/config";
import { EMPTY_PAYLOAD_HASH, sha256Hex, signRequest } from "@/lib/storage/signature";

/**
 * Objecten wegschrijven en ophalen bij een S3-compatibele opslag.
 *
 * Drie operaties, meer heeft deze app niet nodig: een bestand erin, een bestand
 * eruit, en de vraag of het er nog staat. De handtekening zit in
 * `signature.ts` en is daar tegen de testvectoren van AWS aangelegd.
 *
 * Alleen op de server.
 */

export class StorageError extends Error {
  readonly status: number;
  readonly key: string;

  constructor(status: number, key: string, detail: string, options?: { cause?: unknown }) {
    super(`Opslag ${status} op ${key}: ${detail}`, options);
    this.name = "StorageError";
    this.status = status;
    this.key = key;
  }

  /** Het object bestaat niet (meer). Anders dan "de opslag ligt eruit". */
  get isMissing(): boolean {
    return this.status === 404;
  }

  /** Nog eens proberen kan helpen: de dienst knijpt af of ligt er even uit. */
  get isTransient(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export type PutObjectInput = {
  key: string;
  contentType: string;
  /**
   * De inhoud. Bytes worden meegetekend; een stroom niet — die kunnen we niet
   * vooraf hashen zonder hem eerst helemaal in het geheugen te trekken, en een
   * render van tweehonderd megabyte hoort geen tweehonderd megabyte serverheugen
   * te kosten. Zie `payloadHashFor()`.
   */
  body: Uint8Array | ReadableStream<Uint8Array>;
  /** Alleen nodig bij een stroom; de opslag wil van tevoren weten hoeveel er komt. */
  sizeInBytes?: number;
};

export type StoredObject = {
  key: string;
  url: string;
  sizeInBytes: number;
};

export type FetchedObject = {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  /** `null` als de opslag geen lengte meegeeft. */
  sizeInBytes: number | null;
};

export type S3Client = {
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<FetchedObject>;
  /** De grootte, of `null` als het object er niet is. */
  size(key: string): Promise<number | null>;
  /** Het volledige adres van een object; gaat mee in de renderjob. */
  urlFor(key: string): string;
};

export function createS3Client(config: StorageConfig = getStorageConfig()): S3Client {
  async function send(
    method: string,
    key: string,
    options: {
      body?: Uint8Array | ReadableStream<Uint8Array>;
      headers?: Record<string, string>;
      payloadHash: string;
    },
  ): Promise<Response> {
    const { url, canonicalPath } = objectUrl(config, key);

    const signed = await signRequest({
      method,
      path: canonicalPath,
      headers: {
        host: url.host,
        // S3 wil deze kop bij élk verzoek zien, en hij moet meegetekend worden:
        // anders kan iemand onderweg het lichaam vervangen zonder de
        // handtekening ongeldig te maken.
        "x-amz-content-sha256": options.payloadHash,
        ...options.headers,
      },
      payloadHash: options.payloadHash,
      region: config.region,
      service: "s3",
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      date: new Date(),
    });

    let response: Response;

    try {
      response = await fetch(url, {
        method,
        headers: signed.headers,
        body: options.body as BodyInit | undefined,
        // Node wil dit weten zodra het lichaam een stroom is.
        ...(options.body instanceof ReadableStream ? { duplex: "half" } : {}),
      } as RequestInit);
    } catch (error) {
      throw new StorageError(503, key, "de opslag antwoordde niet", { cause: error });
    }

    if (!response.ok) {
      // Het foutbericht van S3 is XML; de code eruit halen scheelt raden bij het
      // lezen van een logregel. `AccessDenied` en `NoSuchBucket` zien er in een
      // statuscode alleen hetzelfde uit.
      const detail = await describeFailure(response);

      throw new StorageError(response.status, key, detail);
    }

    return response;
  }

  return {
    async put({ key, body, contentType, sizeInBytes }) {
      const headers: Record<string, string> = { "content-type": contentType };

      if (body instanceof ReadableStream && sizeInBytes !== undefined) {
        headers["content-length"] = String(sizeInBytes);
      }

      await send("PUT", key, { body, headers, payloadHash: await payloadHashFor(body) });

      return {
        key,
        url: objectUrl(config, key).url.href,
        sizeInBytes: sizeInBytes ?? (body instanceof ReadableStream ? 0 : body.byteLength),
      };
    },

    async get(key) {
      const response = await send("GET", key, { payloadHash: EMPTY_PAYLOAD_HASH });

      if (!response.body) throw new StorageError(502, key, "de opslag gaf geen inhoud terug");

      const length = response.headers.get("content-length");

      return {
        stream: response.body,
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
        sizeInBytes: length ? Number(length) : null,
      };
    },

    async size(key) {
      try {
        const response = await send("HEAD", key, { payloadHash: EMPTY_PAYLOAD_HASH });
        const length = response.headers.get("content-length");

        return length ? Number(length) : 0;
      } catch (error) {
        if (error instanceof StorageError && error.isMissing) return null;

        throw error;
      }
    },

    urlFor(key) {
      return objectUrl(config, key).url.href;
    },
  };
}

/**
 * Wat er in `x-amz-content-sha256` komt.
 *
 * Bytes hashen we echt: dan dekt de handtekening ook de inhoud. Bij een stroom
 * kan dat niet zonder hem eerst helemaal in het geheugen te lezen, en daarvoor
 * bestaat `UNSIGNED-PAYLOAD` — de verbinding is TLS, en de handtekening dekt
 * nog steeds het pad, de kopregels en het moment.
 */
async function payloadHashFor(body: Uint8Array | ReadableStream<Uint8Array>): Promise<string> {
  if (body instanceof ReadableStream) return "UNSIGNED-PAYLOAD";
  if (body.byteLength === 0) return EMPTY_PAYLOAD_HASH;

  return sha256Hex(body);
}

/** De foutcode uit het XML-antwoord van S3, of anders de statustekst. */
async function describeFailure(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  const message = /<Message>([^<]+)<\/Message>/.exec(body)?.[1];

  if (code) return message ? `${code} — ${message}` : code;

  return response.statusText || "onbekende fout";
}
