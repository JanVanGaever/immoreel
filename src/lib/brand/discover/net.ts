import { request as httpRequest } from "node:http";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP } from "node:net";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";

/**
 * Een pagina van buiten ophalen, zonder onze eigen server als opstapje aan te
 * bieden.
 *
 * Dit is de gevaarlijke helft van "haal de huisstijl uit mijn website". De
 * klant geeft een adres en wij halen het op — en dat is precies de vorm van
 * server-side request forgery. Zonder de controles hieronder is dit veld
 * genoeg om onze eigen omgeving uit te lezen:
 *
 *   http://169.254.169.254/latest/meta-data/   de sleutels van de cloudserver
 *   http://127.0.0.1:6379                       de renderwachtrij
 *   http://192.168.1.1                          apparatuur in het netwerk
 *
 * Vier sloten, en ze zijn geen van alle optioneel:
 *
 * 1. **Alleen http en https.** Geen `file:`, geen `gopher:`, geen `data:`.
 * 2. **Het IP wordt gekeurd in de `lookup` zelf.** Niet ervoor — daartussen zit
 *    anders een gaatje waarin een domein zijn antwoord kan wisselen (DNS
 *    rebinding): eerst een publiek adres om de controle te halen, dan een
 *    intern adres om verbinding mee te maken. Door de keuring in de lookup te
 *    zetten, is het adres dat goedgekeurd wordt hetzelfde adres waarmee
 *    verbonden wordt.
 * 3. **Elke omleiding opnieuw.** Een publieke URL die doorstuurt naar
 *    `localhost` is de eenvoudigste manier om slot 2 te omzeilen.
 * 4. **Een plafond op tijd en op bytes.** Anders is één traag adres genoeg om
 *    onze verzoeken te laten opstapelen.
 *
 * Alleen op de server, en bewust met `node:https` in plaats van `fetch`: die
 * laatste laat niet toe om de naamopzoeking over te nemen, en dat is precies
 * waar slot 2 op staat.
 */

export class UnreachableSiteError extends Error {
  readonly reason: "ongeldig" | "geweigerd" | "onbereikbaar" | "te-groot" | "geen-html";

  constructor(reason: UnreachableSiteError["reason"], message: string) {
    super(message);
    this.name = "UnreachableSiteError";
    this.reason = reason;
  }
}

export type FetchedPage = {
  /** Waar we uiteindelijk uitkwamen; kan afwijken door omleidingen. */
  url: string;
  html: string;
};

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8_000;

/**
 * Adresruimtes die nooit van een klantwebsite zijn.
 *
 * De lijst staat er voluit en niet als slimme berekening, omdat elk bereik hier
 * een eigen reden heeft om geweerd te worden — en omdat een lezer moet kunnen
 * nagaan of er eentje ontbreekt.
 */
function isBlockedAddress(ip: string): boolean {
  if (isIP(ip) === 6) return isBlockedIPv6(ip.toLowerCase());

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;

  const [a = 0, b = 0] = parts;

  return (
    a === 0 || // dit netwerk
    a === 10 || // privé
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, en dus de metadata van de cloud
    (a === 172 && b >= 16 && b <= 31) || // privé
    (a === 192 && b === 168) || // privé
    (a === 192 && b === 0) || // IETF-toewijzingen
    (a === 198 && b >= 18 && b <= 19) || // benchmarking
    a >= 224 // multicast en gereserveerd
  );
}

function isBlockedIPv6(ip: string): boolean {
  const bare = ip.startsWith("[") ? ip.slice(1, -1) : ip;

  // Een IPv4 in IPv6-jasje is nog altijd hetzelfde adres, en er zijn twee
  // schrijfwijzen voor. `new URL()` normaliseert bovendien naar de tweede:
  // `::ffff:127.0.0.1` komt er als `::ffff:7f00:1` weer uit. Alleen op de
  // eerste vorm controleren is dus precies niets controleren.
  const decimal = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(bare);
  if (decimal?.[1]) return isBlockedAddress(decimal[1]);

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(bare);

  if (hex) {
    const high = Number.parseInt(hex[1] ?? "0", 16);
    const low = Number.parseInt(hex[2] ?? "0", 16);

    return isBlockedAddress(
      [high >> 8, high & 0xff, low >> 8, low & 0xff].join("."),
    );
  }

  return (
    bare === "::" ||
    bare === "::1" || // loopback
    bare.startsWith("fe80") || // link-local
    bare.startsWith("fc") || // unique local
    bare.startsWith("fd") ||
    bare.startsWith("ff") // multicast
  );
}

/**
 * De naamopzoeking met een keuring erin.
 *
 * Dit is slot 2. Node roept deze functie aan vlak voor het verbinden, dus wat
 * hier goedgekeurd wordt, is het adres waarmee verbonden wordt — er zit geen
 * moment tussen waarin het antwoord nog kan wisselen.
 */
export const guardedLookup: RequestOptions["lookup"] = (hostname, options, callback) => {
  dnsLookup(hostname, { ...(options as object), all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);

    const list = (Array.isArray(addresses) ? addresses : [addresses]) as LookupAddress[];

    // Élk adres wordt gekeurd en niet alleen het eerste. Geven we er straks
    // meerdere terug, dan mag Node zelf kiezen welke hij probeert — en dan moet
    // ook de laatste in die lijst er een zijn waar we heen mogen.
    const allowed = list.filter((entry) => !isBlockedAddress(entry.address));

    if (allowed.length === 0) {
      return callback(
        new UnreachableSiteError(
          "geweigerd",
          `${hostname} wijst naar een adres binnen ons eigen netwerk.`,
        ),
        "",
        4,
      );
    }

    // De vorm van het antwoord moet die van de vraag volgen. De HTTP-client van
    // Node vraagt zélf om `all: true` en verwacht dan een lijst; wie daar één
    // adres teruggeeft, krijgt `ERR_INVALID_IP_ADDRESS: undefined` en dus een
    // mislukte verbinding met elke site die bestaat.
    if ((options as { all?: boolean }).all) {
      return (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(
        null,
        allowed,
      );
    }

    callback(null, allowed[0]!.address, allowed[0]!.family);
  });
};

/** De vorm van het adres, voor er ook maar iets opgezocht wordt. */
export function parsePublicUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new UnreachableSiteError("ongeldig", "Vul een webadres in.");

  // Staat er een schema, dan moet dat er een van ons zijn. Dit vóór het
  // aanvullen, en dat is geen volgordekwestie maar het slot zelf: wie
  // `file:///etc/passwd` klakkeloos aanvult tot `https://file:///etc/passwd`,
  // maakt er een geldig adres van en laat het langs de controle hieronder
  // glippen.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1]?.toLowerCase();

  if (scheme && scheme !== "http" && scheme !== "https") {
    throw new UnreachableSiteError("ongeldig", "Alleen adressen die met http of https beginnen.");
  }

  let url: URL;

  try {
    // Zonder schema is "kantoorjanssens.be" bedoeld, niet een pad.
    url = new URL(scheme ? trimmed : `https://${trimmed}`);
  } catch {
    throw new UnreachableSiteError("ongeldig", "Dit is geen geldig webadres.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnreachableSiteError("ongeldig", "Alleen adressen die met http of https beginnen.");
  }

  // Een gebruikersnaam in de URL is nooit iets wat een klant bedoelt, en wel
  // iets waarmee een filter om de tuin geleid wordt.
  if (url.username || url.password) {
    throw new UnreachableSiteError("ongeldig", "Laat inloggegevens uit het adres weg.");
  }

  // Een adres dat al een IP is, komt niet langs de naamopzoeking en moet hier
  // dus zelf gekeurd worden. De haakjes eraf: `new URL()` geeft een IPv6-host
  // terug als `[::1]`, en dat is voor `isIP()` geen IP-adres — waardoor
  // `http://[::1]:6379` anders vrolijk langs deze controle wandelt.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isBlockedAddress(host)) {
    throw new UnreachableSiteError("geweigerd", "Dit adres ligt binnen ons eigen netwerk.");
  }

  return url;
}

export type FetchOptions = {
  /** Kleiner budget voor de stylesheets die na de pagina opgehaald worden. */
  maxBytes?: number;
  accept?: string;
};

export type FetchedResource = {
  url: string;
  body: Buffer;
  contentType: string;
};

/**
 * Eén verzoek, met alle sloten erop. Volgt omleidingen zelf.
 *
 * Geeft ruwe bytes terug, want niet alles wat we ophalen is tekst: het logo van
 * een kantoor is een PNG. `fetchPublicPage()` is de tekstversie hierop.
 */
export async function fetchPublicResource(
  raw: string,
  options: FetchOptions = {},
): Promise<FetchedResource> {
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  let url = parsePublicUrl(raw);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await send(url, options.accept ?? "text/html,*/*;q=0.8", maxBytes);

    if (response.location) {
      if (hop === MAX_REDIRECTS) {
        throw new UnreachableSiteError("onbereikbaar", "Deze site stuurt te vaak door.");
      }

      // Slot 3: de nieuwe bestemming gaat door dezelfde keuring als de eerste.
      url = parsePublicUrl(new URL(response.location, url).href);
      continue;
    }

    return { url: url.href, body: response.body, contentType: response.contentType };
  }

  throw new UnreachableSiteError("onbereikbaar", "Deze site stuurt te vaak door.");
}

/** Hetzelfde, maar als tekst — voor pagina's en stylesheets. */
export async function fetchPublicPage(
  raw: string,
  options: FetchOptions = {},
): Promise<FetchedPage> {
  const resource = await fetchPublicResource(raw, options);

  return { url: resource.url, html: resource.body.toString("utf8") };
}

type RawResponse = { body: Buffer; location: string | null; contentType: string };

function send(url: URL, accept: string, maxBytes: number): Promise<RawResponse> {
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const request = send(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        headers: {
          // Eerlijk zeggen wie er belt; een kantoor dat zijn logs leest, hoort
          // te kunnen zien dat dit wij zijn en niet een scraper.
          "user-agent": "ImmoreelBrandBot/1.0 (+https://immoreel.be)",
          accept,
          // Zonder dit moeten we zelf uitpakken, en gzip-bommen zijn een
          // manier om het byteplafond te omzeilen.
          "accept-encoding": "identity",
        },
        timeout: TIMEOUT_MS,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentType = String(response.headers["content-type"] ?? "");
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          response.destroy();
          resolve({ body: Buffer.alloc(0), location, contentType: "" });

          return;
        }

        if (status < 200 || status >= 300) {
          response.destroy();
          reject(
            new UnreachableSiteError("onbereikbaar", `Deze site antwoordde met ${status}.`),
          );

          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;

        response.on("data", (chunk: Buffer) => {
          size += chunk.length;

          // Slot 4: afkappen tijdens het lezen en niet erna. Wat er al binnen
          // is, is ruim genoeg om een huisstijl uit te halen.
          if (size > maxBytes) {
            response.destroy();
            resolve({ body: Buffer.concat(chunks), location: null, contentType });

            return;
          }

          chunks.push(chunk);
        });

        response.on("end", () =>
          resolve({ body: Buffer.concat(chunks), location: null, contentType }),
        );
        response.on("error", () =>
          reject(new UnreachableSiteError("onbereikbaar", "De verbinding brak af.")),
        );
      },
    );

    request.on("timeout", () => {
      request.destroy();
      reject(new UnreachableSiteError("onbereikbaar", "Deze site antwoordde niet op tijd."));
    });

    request.on("error", (error: unknown) => {
      if (error instanceof UnreachableSiteError) return reject(error);

      reject(new UnreachableSiteError("onbereikbaar", "We konden deze site niet bereiken."));
    });

    request.end();
  });
}
