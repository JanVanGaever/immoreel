import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

/**
 * Het bestand achter een afgewerkte render openen.
 *
 * De renderworker schrijft naar de opslag en zet er een URL bij (zie
 * `src/workers/render/storage.ts`). Lokaal is dat een `file://`-pad, met een
 * bucket erachter een `https://`-URL. De browser kan het eerste niet openen en
 * het tweede alleen als het publiek staat — dus loopt elke download via de app,
 * en is dit de plek die van zo'n URL weer bytes maakt.
 *
 * Dat het via de app loopt, kost een sprong, maar levert drie dingen op die je
 * met een rechtstreekse link kwijt bent: de rechtencontrole blijft staan, de
 * bestandsnaam is die van het pand in plaats van een opslagsleutel, en de
 * opslag mag morgen iets anders zijn zonder dat de knop verandert.
 */

export type RenderOutput = {
  stream: ReadableStream<Uint8Array>;
  /** `null` wanneer de bron zelf niet weet hoe groot ze is. */
  sizeInBytes: number | null;
  contentType: string;
};

/**
 * Enkel schema's die wij zelf wegschrijven. De URL komt uit onze eigen store en
 * niet van een gebruiker, maar een lijst die je expliciet moet uitbreiden is de
 * goedkoopste manier om dat zo te houden.
 */
const ALLOWED_PROTOCOLS = new Set(["file:", "http:", "https:"]);

export class RenderOutputError extends Error {
  readonly reason: "unsupported" | "missing" | "unreachable";

  constructor(reason: RenderOutputError["reason"], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RenderOutputError";
    this.reason = reason;
  }
}

export async function openRenderOutput(
  url: string,
  contentType = "video/mp4",
): Promise<RenderOutput> {
  const parsed = parse(url);

  if (parsed.protocol === "file:") return openFile(parsed, contentType);

  return openRemote(parsed, contentType);
}

function parse(url: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch (error) {
    throw new RenderOutputError("unsupported", "De opslaglocatie is onleesbaar.", { cause: error });
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new RenderOutputError("unsupported", `Opslag via ${parsed.protocol} wordt niet bediend.`);
  }

  return parsed;
}

async function openFile(url: URL, contentType: string): Promise<RenderOutput> {
  const path = fileURLToPath(url);

  let sizeInBytes: number;

  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error("Geen bestand.");

    sizeInBytes = info.size;
  } catch (error) {
    // Het bestand stond er wel toen de job klaar was; nu niet meer. Dat is een
    // opgeruimde werkmap of een verhuisde opslag, geen fout van deze aanvraag.
    throw new RenderOutputError("missing", "Het bestand staat niet meer in de opslag.", {
      cause: error,
    });
  }

  // De bytes lopen door naar de browser zonder eerst in het geheugen te passen;
  // een render van 200 MB mag geen 200 MB serverheugen kosten.
  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;

  return { stream, sizeInBytes, contentType };
}

async function openRemote(url: URL, contentType: string): Promise<RenderOutput> {
  let response: Response;

  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (error) {
    throw new RenderOutputError("unreachable", "De opslag antwoordde niet.", { cause: error });
  }

  if (!response.ok || !response.body) {
    throw new RenderOutputError(
      response.status === 404 ? "missing" : "unreachable",
      `De opslag antwoordde met ${response.status}.`,
    );
  }

  const length = response.headers.get("content-length");

  return {
    stream: response.body,
    sizeInBytes: length ? Number(length) : null,
    contentType: response.headers.get("content-type") ?? contentType,
  };
}

/**
 * De `Content-Disposition` van een download.
 *
 * De naam gaat er twee keer in: één keer uitgekleed tot ASCII voor oude
 * clients, en één keer als UTF-8 volgens RFC 5987. Onze bestandsnamen zijn al
 * geslugd, dus in de praktijk zijn beide gelijk — tot iemand hier ooit een
 * naam met een accent doorgeeft, en dan valt er niets stuk.
 */
export function attachmentHeader(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
