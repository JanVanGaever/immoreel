import { hasEnoughContrast, normaliseHex } from "@/lib/brand/colors";
import type { BrandFontId } from "@/types";

/**
 * Wat er uit de broncode van een website te halen valt.
 *
 * Alles hier werkt op tekst en niets hier praat met het netwerk: dat maakt de
 * regels los te testen met een stuk HTML in plaats van met een echte site.
 *
 * Bewust met patronen en niet met een DOM-parser. Een parser erbij zou voor
 * deze handvol velden een afhankelijkheid van een megabyte betekenen, en de
 * dingen die we zoeken staan op vaste plekken: in `<meta>`, in `<link>`, in
 * JSON-LD en in CSS-variabelen. Wat er niet uitkomt, komt er niet uit — de
 * gebruiker vult dat gewoon zelf in, en dat is de reden dat dit een voorstel is
 * en geen automaat.
 */

/** Waar een waarde vandaan komt. Staat op het scherm, zodat een gebruiker kan wegen. */
export type SignalSource =
  | "schema-org"
  | "meta"
  | "css-variabele"
  | "link"
  | "tekst"
  | "stylesheet";

export type Signal<T> = {
  value: T;
  source: SignalSource;
  /** 0–1. Hoe zeker we zijn dat dit echt de huisstijl is en niet iets toevalligs. */
  confidence: number;
};

function signal<T>(value: T, source: SignalSource, confidence: number): Signal<T> {
  return { value, source, confidence };
}

/* -------------------------------------------------------------------------
 * Kleine hulpjes op de broncode
 * ---------------------------------------------------------------------- */

/**
 * De gangbare HTML-entiteiten terug naar tekens.
 *
 * Zonder dit heet een kantoor "Janssens &amp; Zonen" en staat dat zo in de
 * video. Het viel op bij de eerste echte site: `Belgium&#039;s` in plaats van
 * `Belgium's` — een testpagina die je zelf schrijft, bevat die dingen nu eenmaal
 * niet.
 */
export function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => named[name.toLowerCase()] ?? whole);
}

/** Alle `<script type="application/ld+json">` blokken, uitgepakt. */
export function readJsonLd(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    try {
      const parsed = JSON.parse(match[1] ?? "") as unknown;

      // Een `@graph` is een lijst met daarin de echte dingen; die pakken we uit
      // zodat de zoeker verderop niet twee vormen hoeft te kennen.
      if (parsed && typeof parsed === "object" && "@graph" in parsed) {
        const graph = (parsed as { "@graph": unknown })["@graph"];
        if (Array.isArray(graph)) blocks.push(...graph);
        continue;
      }

      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // Kapotte JSON-LD is doodnormaal op het web; die slaan we over.
    }
  }

  return blocks;
}

/** De waarde van `<meta name="..." content="...">`, in beide volgordes. */
export function readMeta(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }

  return null;
}

/**
 * De titel van de pagina, en niet die van het eerste het beste icoontje.
 *
 * Een `<svg>` mag een eigen `<title>` hebben — dat is de toegankelijke naam van
 * het pictogram. Staat er zo eentje boven in de opmaak, dan levert "de eerste
 * `<title>` in het document" iets als `icon-check` op. Dat is precies wat er
 * gebeurde bij een van de echte sites.
 *
 * Dus alleen kijken binnen `<head>`: daar staat er maar één, en het is de
 * juiste.
 */
export function readTitle(html: string): string | null {
  const head = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? html.slice(0, 50_000);

  // De pictogrammen eruit vóór we zoeken. Bij een echte site stonden er twee
  // titels in de `<head>`: eerst `icon-check` van een inline SVG, dan pas de
  // titel van de pagina. Alleen "binnen de head" kijken is dus niet genoeg.
  const zonderIconen = head.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(zonderIconen)?.[1];

  return title?.trim() || null;
}

/**
 * De inhoud van alle `<style>`-blokken in de pagina.
 *
 * Nodig omdat een moderne site zijn CSS vaak niet meer als los bestand serveert:
 * frameworks zetten de stijlen van de eerste weergave inline in de opmaak. Bij
 * een van de geteste kantoren stond álle CSS in één `<style>`-blok van 280 kB —
 * en dan vindt een zoektocht die alleen naar losse stylesheets kijkt, niets.
 */
export function readInlineStyles(html: string): string {
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1] ?? "")
    .join("\n");
}

/** De `href` van een `<link rel="...">`. */
export function readLinkHref(html: string, rel: string): string | null {
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const patterns = [
    new RegExp(`<link[^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]+href=["']([^"']+)["']`, "i"),
    new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${escaped}[^"']*["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

/* -------------------------------------------------------------------------
 * Kleuren
 * ---------------------------------------------------------------------- */

/** `rgb(12, 74, 63)` en `#0c4a3f` worden allebei `#0c4a3f`. */
export function toHex(value: string): string | null {
  const text = value.trim();

  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(text);

  if (rgb) {
    const [, r = "0", g = "0", b = "0"] = rgb;
    const channels = [r, g, b].map((channel) => Number(channel));

    if (channels.some((channel) => channel < 0 || channel > 255)) return null;

    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }

  return normaliseHex(text);
}

/**
 * Hoe kleurig een kleur is, van 0 (grijs) tot 1 (vol).
 *
 * Een website is voor het grootste deel wit, zwart en grijs. Zonder deze maat
 * is de meest voorkomende kleur op elke site `#ffffff`, en dan stelt de
 * huisstijl van elk kantoor hetzelfde voor.
 */
export function saturation(hex: string): number {
  const normalised = normaliseHex(hex);
  if (!normalised) return 0;

  const [r = 0, g = 0, b = 0] = [1, 3, 5].map(
    (offset) => Number.parseInt(normalised.slice(offset, offset + 2), 16) / 255,
  );

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) return 0;

  return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/** Bijna wit of bijna zwart: bruikbaar als achtergrond, niet als merkkleur. */
function isNeutral(hex: string): boolean {
  const normalised = normaliseHex(hex);
  if (!normalised) return true;

  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(normalised.slice(offset, offset + 2), 16),
  );
  const average = channels.reduce((total, channel) => total + channel, 0) / 3;

  // De bovengrens ligt op 225 en niet op 250, omdat pasteltinten als `#ffffcc`
  // wel verzadigd genoeg zijn om door de eerste toets te komen maar geen
  // merkkleur zijn — het zijn markeerkleuren. Op een eindkaart zijn ze
  // onbruikbaar: er past geen enkele tekstkleur leesbaar op.
  return saturation(normalised) < 0.15 || average > 225 || average < 15;
}

/**
 * Namen van CSS-variabelen die over het merk gaan, in volgorde van hoe stellig
 * ze zijn. `--primary` is een uitspraak; `--color-1` is een nummer.
 */
const PRIMARY_HINTS = ["primary", "brand", "main", "theme"];
const SECONDARY_HINTS = ["secondary", "accent", "highlight"];

/**
 * Variabelen van bibliotheken. Hun naam zegt niets over dít kantoor.
 *
 * Dit kwam uit een echte site: `--swiper-theme-color:#007aff` is de
 * standaardkleur van een carrouselbibliotheek — Apple-blauw, hetzelfde op elke
 * site die Swiper gebruikt. Omdat "theme" in de naam staat, kreeg die kleur het
 * hoogste gewicht en versloeg hij het goud dat honderdzeven keer in dezelfde
 * stylesheet stond en wél het merk was.
 */
const LIBRARY_VARIABLE_PREFIXES = [
  "swiper-",
  "bs-", // Bootstrap
  "mui-",
  "fa-", // Font Awesome
  "tw-", // Tailwind intern
  "ion-",
  "wp--", // WordPress
  "chakra-",
  "mantine-",
];

function isLibraryVariable(name: string): boolean {
  return LIBRARY_VARIABLE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export type ColorCandidate = { hex: string; name: string; weight: number };

/**
 * Alle CSS-variabelen met een kleur erin, met een gewicht op hun naam.
 *
 * Werkt zowel op een `<style>`-blok in de pagina als op een los opgehaalde
 * stylesheet — het is dezelfde tekst.
 */
export function readColorVariables(css: string): ColorCandidate[] {
  const candidates: ColorCandidate[] = [];
  const pattern = /--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))/gi;

  for (const match of css.matchAll(pattern)) {
    const name = (match[1] ?? "").toLowerCase();
    const hex = toHex(match[2] ?? "");

    if (!hex || isNeutral(hex) || isLibraryVariable(name)) continue;

    const isPrimary = PRIMARY_HINTS.some((hint) => name.includes(hint));
    const isSecondary = SECONDARY_HINTS.some((hint) => name.includes(hint));

    candidates.push({
      hex,
      name,
      // Een variabele die zichzelf "primary" noemt, weegt zwaarder dan een die
      // toevallig een kleur bevat.
      weight: isPrimary ? 3 : isSecondary ? 2 : 1,
    });
  }

  return candidates;
}

/**
 * Kleuren die gewoon in de CSS staan, geteld op hoe vaak ze voorkomen.
 *
 * Dit is de belangrijkste bron, en dat bleek pas op echte sites: van de drie
 * makelaarskantoren die we probeerden had er **geen enkele** CSS-variabelen.
 * Hun huisstijl staat er als gewone hexcode in, en de merkkleur is domweg de
 * kleur die het vaakst gebruikt wordt — bij Sorenco `#002e5e` (59 keer) en
 * `#c4a163` (46 keer), en dat is precies hun donkerblauw met goud.
 *
 * Grijs, wit en zwart tellen niet mee: die staan op élke site bovenaan, en dan
 * krijgt elk kantoor dezelfde huisstijl.
 */
export function readColorFrequency(css: string): ColorCandidate[] {
  const counts = new Map<string, number>();
  const pattern = /(#[0-9a-f]{3}\b|#[0-9a-f]{6}\b|rgba?\([^)]{5,40}\))/gi;

  for (const match of css.matchAll(pattern)) {
    const hex = toHex(match[1] ?? "");
    if (!hex || isNeutral(hex)) continue;

    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, count]) => ({ hex, name: `${count}×`, weight: weightForCount(count) }));
}

/**
 * Hoe zwaar telt "deze kleur komt vaak voor"?
 *
 * Frequentie kreeg eerder altijd het laagste gewicht, waardoor één variabele met
 * een goede naam won van een kleur die honderd keer in dezelfde stylesheet
 * stond. Dat is de verkeerde volgorde: een naam is een aanwijzing, maar honderd
 * voorkomens zijn een patroon. Een kleur die de hele site draagt, is de kleur
 * van het kantoor.
 */
function weightForCount(count: number): number {
  if (count >= 50) return 3;
  if (count >= 15) return 2;

  return 1;
}

/**
 * Donkere kleuren, geteld — ook de onverzadigde.
 *
 * Apart van `readColorFrequency()`, want ze doen iets anders. Een donkergrijs is
 * geen mérkkleur (die filteren we juist weg, anders krijgt elk kantoor
 * hetzelfde), maar wel een prima **achtergrond**: er past witte tekst op, en dat
 * is wat de intro- en eindkaart nodig hebben.
 *
 * Dit kwam uit een echt kantoor: een site met een zwarte achtergrond en fel geel
 * als accent. Zonder deze lijst werd het geel de achtergrond van de eindkaart,
 * en daar is geen enkele tekstkleur leesbaar op.
 */
export function readDarkCandidates(css: string): ColorCandidate[] {
  const counts = new Map<string, number>();
  const pattern = /(#[0-9a-f]{3}\b|#[0-9a-f]{6}\b|rgba?\([^)]{5,40}\))/gi;

  for (const match of css.matchAll(pattern)) {
    const hex = toHex(match[1] ?? "");
    if (!hex) continue;

    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
    const average = channels.reduce((total, channel) => total + channel, 0) / 3;

    // Donker genoeg om witte tekst te dragen, en niet zó zwart dat het de
    // standaardtekstkleur van elke site is.
    if (average > 80 || average < 8) continue;

    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([hex, count]) => ({ hex, name: `${count}×`, weight: 1 }));
}

export type ColorFindings = {
  primary: Signal<string> | null;
  secondary: Signal<string> | null;
  /** Zin voor de gebruiker wanneer we de volgorde omgedraaid hebben. */
  note: string | null;
};

/**
 * De twee kleuren die de huisstijl nodig heeft.
 *
 * Drie bronnen, in volgorde van hoe stellig ze zijn: een variabele die zichzelf
 * "primary" of "brand" noemt, de `theme-color` van de pagina, en anders gewoon
 * de kleur die het vaakst in de CSS staat.
 *
 * Eén regel gaat boven die volgorde: **de hoofdkleur moet witte tekst kunnen
 * dragen.** Ze wordt de achtergrond van de intro- en de eindkaart, en een titel
 * die daarop onleesbaar is, is geen huisstijl maar een onbruikbare video. Vindt
 * de site zelf iets anders — een fel accent dat `--primary` heet — dan schuift
 * dat naar de accentkleur en zeggen we dat erbij.
 */
export function pickColors(html: string, css: string): ColorFindings {
  const themeColor = toHex(readMeta(html, "theme-color") ?? "");

  // De stijlen die in de pagina zelf staan tellen even hard mee als een los
  // stylesheet: voor een site die zijn CSS inline zet, zijn ze de enige bron.
  const alleCss = `${readInlineStyles(html)}\n${css}`;

  const candidates: ColorCandidate[] = [
    ...readColorVariables(html),
    ...readColorVariables(css),
  ];

  if (themeColor && !isNeutral(themeColor)) {
    candidates.push({ hex: themeColor, name: "theme-color", weight: 3 });
  }

  // De frequentietelling erbij, maar achteraan: een naam is een uitspraak, een
  // telling is een gok. Alleen kleuren die nog niet gevonden waren.
  for (const found of readColorFrequency(alleCss)) {
    if (!candidates.some((candidate) => candidate.hex === found.hex)) candidates.push(found);
  }

  if (candidates.length === 0) return { primary: null, secondary: null, note: null };

  const ranked = [...candidates].sort((a, b) => b.weight - a.weight);
  const best = ranked[0]!;

  // Kan de sterkste kandidaat witte tekst dragen? Zo niet, dan pakken we de
  // eerste die dat wél kan — die staat toch al op de lijst van deze site. En
  // heeft geen enkele merkkleur genoeg contrast, dan mag een donkere kleur van
  // de site het doen: een kantoor met een zwarte site en een fel accent heeft
  // die donkere kleur echt als achtergrond, ook al is het geen merkkleur.
  const draagbaar =
    ranked.find((candidate) => hasEnoughContrast(candidate.hex, "#ffffff")) ??
    readDarkCandidates(alleCss)[0];

  const primary = draagbaar ?? best;
  const omgedraaid = draagbaar !== undefined && draagbaar.hex !== best.hex;

  // De accentkleur mag juist wél fel zijn: die draagt de knop op de eindkaart,
  // niet de tekst erachter. Vandaar dat `best` hier gewoon in aanmerking komt.
  const secondary =
    ranked.find((candidate) => candidate.hex !== primary.hex && candidate.weight >= 2) ??
    ranked.find((candidate) => candidate.hex !== primary.hex);

  return {
    primary: signal(primary.hex, sourceOf(primary), confidenceOf(primary)),
    secondary: secondary
      ? signal(secondary.hex, sourceOf(secondary), confidenceOf(secondary) - 0.05)
      : null,
    note: omgedraaid
      ? `We namen ${primary.hex} als hoofdkleur: op ${best.hex} is witte tekst niet leesbaar. ${best.hex} staat als accentkleur klaar.`
      : null,
  };
}

function sourceOf(candidate: ColorCandidate): SignalSource {
  if (candidate.name === "theme-color") return "meta";

  return candidate.name.endsWith("×") ? "stylesheet" : "css-variabele";
}

function confidenceOf(candidate: ColorCandidate): number {
  if (candidate.weight === 3) return 0.8;
  if (candidate.weight === 2) return 0.7;

  // Een kleur die alleen geteld is: hoe vaker, hoe waarschijnlijker dat ze van
  // het merk is en niet van een knop die één keer voorkomt.
  const count = Number.parseInt(candidate.name, 10);

  return Number.isFinite(count) && count >= 20 ? 0.6 : 0.45;
}

/* -------------------------------------------------------------------------
 * Contact en naam
 * ---------------------------------------------------------------------- */

export type ContactFindings = {
  agentName: Signal<string> | null;
  phone: Signal<string> | null;
  email: Signal<string> | null;
};

/** De soorten waaronder een makelaarskantoor zichzelf in JSON-LD zet. */
const BUSINESS_TYPES = ["RealEstateAgent", "LocalBusiness", "Organization", "Corporation"];

function typeOf(node: Record<string, unknown>): string[] {
  const raw = node["@type"];

  return (Array.isArray(raw) ? raw : [raw]).filter(
    (value): value is string => typeof value === "string",
  );
}

function textOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return decodeEntities(value.trim());

  // `{"@type":"ImageObject","url":"..."}` en `["a","b"]` komen allebei voor.
  if (Array.isArray(value)) return textOf(value[0]);
  if (value && typeof value === "object" && "url" in value) {
    return textOf((value as { url: unknown }).url);
  }
  if (value && typeof value === "object" && "name" in value) {
    return textOf((value as { name: unknown }).name);
  }

  return null;
}

/**
 * Naam, telefoon en e-mail.
 *
 * Dit is het deel dat het vaakst raak is, en dat is geen toeval: een
 * vastgoedkantoor dat gevonden wil worden, zet zijn gegevens in JSON-LD voor
 * Google. Wat daar staat is door het kantoor zelf ingevuld en dus betrouwbaarder
 * dan wat we uit de tekst zouden vissen.
 */
export function readContact(html: string): ContactFindings {
  const found: ContactFindings = { agentName: null, phone: null, email: null };

  for (const block of readJsonLd(html)) {
    if (!block || typeof block !== "object") continue;

    const node = block as Record<string, unknown>;
    if (!typeOf(node).some((type) => BUSINESS_TYPES.includes(type))) continue;

    const name = textOf(node.name);
    const phone = textOf(node.telephone);
    const email = textOf(node.email);

    // Ook een naam uit schema.org kan een titel zijn: "Dewaele | vastgoed met
    // advies" is wat één kantoor er letterlijk in zet. Staat er een
    // scheidingsteken in, dan is het samengesteld en halen we de naam eruit.
    if (name && !found.agentName) {
      found.agentName = signal(
        /[|–—:·•]/.test(name) ? nameFromTitle(name) : name,
        "schema-org",
        0.9,
      );
    }
    if (phone && !found.phone) found.phone = signal(phone, "schema-org", 0.9);
    if (email && !found.email) found.email = signal(email, "schema-org", 0.9);
  }

  // Terugval op de pagina zelf. Minder zeker: een `mailto:` kan ook van de
  // webbouwer in de voettekst zijn.
  if (!found.email) {
    const match = /href=["']mailto:([^"'?]+)/i.exec(html);

    // Entiteiten eerst. Sites verbergen hun adres vaak als
    // `&#105;&#110;&#102;&#111;@...` tegen spam; zonder decoderen zetten we die
    // letterlijke reeks in de huisstijl.
    if (match?.[1]) {
      found.email = signal(decodeEntities(decodeURIComponent(match[1])).trim(), "link", 0.5);
    }
  }

  if (!found.phone) {
    const match = /href=["']tel:([^"']+)/i.exec(html);
    if (match?.[1]) {
      found.phone = signal(decodeEntities(decodeURIComponent(match[1])).trim(), "link", 0.5);
    }
  }

  if (!found.agentName) {
    const site = readMeta(html, "og:site_name");
    // `og:title` is door het kantoor zelf gezet en overleeft de rommel in de
    // opmaak; hij staat daarom vóór het `<title>`-element.
    const title = readMeta(html, "og:title") ?? readTitle(html);

    if (site) found.agentName = signal(site, "meta", 0.6);
    else if (title) found.agentName = signal(nameFromTitle(title), "tekst", 0.4);
  }

  return found;
}

/**
 * De naam van het kantoor uit een paginatitel.
 *
 * Een titel is bijna altijd samengesteld: "Home | Buytaert Immo",
 * "Immoweb: Belgium's leading property website". Botweg het eerste stuk pakken
 * levert "Home" op — dat is wat er gebeurde bij de eerste echte site die we
 * probeerden.
 *
 * Dus: opdelen, de woorden weggooien die op elke homepagina staan, en dan het
 * éérste stuk nemen dat overblijft. Een kantoor zet zijn naam vooraan en zijn
 * slogan erachter.
 *
 * Eerder stond hier "het kortste stuk", en dat brak op een echte site:
 * "Lefever Vastgoed uit Kapellen | Omdat vastgoed mijn passie is" heeft een
 * slogan die één teken korter is dan de naam, en dan wordt de slogan de naam
 * van het kantoor.
 */
export function nameFromTitle(title: string): string {
  const generiek = new Set([
    "home",
    "homepage",
    "welkom",
    "welcome",
    "start",
    "startpagina",
    "index",
    "hoofdpagina",
    "accueil",
  ]);

  const delen = decodeEntities(title)
    .split(/[|–—:·•]|\s-\s/)
    .map((deel) => deel.trim())
    .filter((deel) => deel.length > 1 && !generiek.has(deel.toLowerCase()));

  if (delen.length === 0) return decodeEntities(title).trim();

  return delen[0]!;
}

/* -------------------------------------------------------------------------
 * Logo
 * ---------------------------------------------------------------------- */

/**
 * Alle logokandidaten, beste eerst.
 *
 * Een lijst en niet één adres, omdat de beste bron niet altijd werkt: een van
 * de geteste kantoren wijst in zijn eigen schema.org-gegevens naar een
 * `logo.png` die 404 geeft. Dat is hun vergissing, maar het kost ons het logo —
 * tenzij we daarna gewoon het volgende adres proberen.
 */
export function readLogoCandidates(html: string, baseUrl: string): Signal<string>[] {
  const kandidaten: Signal<string>[] = [];
  const gezien = new Set<string>();

  const voegToe = (signalen: Signal<string> | null): void => {
    if (!signalen || gezien.has(signalen.value)) return;

    gezien.add(signalen.value);
    kandidaten.push(signalen);
  };

  voegToe(readLogo(html, baseUrl));

  const absolute = (href: string): string | null => {
    try {
      // Entiteiten eerst. In HTML hoort een ampersand binnen een attribuut als
      // `&amp;` geschreven te worden, en precies dat doet de beeldbewerker van
      // een framework in zijn adres: `?url=...&amp;w=3840&amp;q=75`. Zonder
      // decoderen vragen we een adres op dat letterlijk `&amp;w=` bevat, en dat
      // bestaat niet — het logo van een echte site viel daarop af.
      return new URL(decodeEntities(href), baseUrl).href;
    } catch {
      return null;
    }
  };

  // Alle afbeeldingen met "logo" in hun opmaak, niet alleen de eerste.
  for (const tag of html.matchAll(/<img[^>]*>/gi)) {
    if (!/logo/i.test(tag[0])) continue;

    const src = /src=["']([^"']+)["']/i.exec(tag[0])?.[1];
    const url = src ? absolute(src) : null;

    if (url) voegToe(signal(url, "tekst", 0.55));
  }

  for (const rel of ["apple-touch-icon", "icon", "shortcut icon"]) {
    const href = readLinkHref(html, rel);
    const url = href ? absolute(href) : null;

    if (url) voegToe(signal(url, "link", 0.4));
  }

  return kandidaten;
}

/** Het beste adres van het logo, als we er een kunnen aanwijzen. */
export function readLogo(html: string, baseUrl: string): Signal<string> | null {
  const absolute = (href: string): string | null => {
    try {
      // Entiteiten eerst. In HTML hoort een ampersand binnen een attribuut als
      // `&amp;` geschreven te worden, en precies dat doet de beeldbewerker van
      // een framework in zijn adres: `?url=...&amp;w=3840&amp;q=75`. Zonder
      // decoderen vragen we een adres op dat letterlijk `&amp;w=` bevat, en dat
      // bestaat niet — het logo van een echte site viel daarop af.
      return new URL(decodeEntities(href), baseUrl).href;
    } catch {
      return null;
    }
  };

  for (const block of readJsonLd(html)) {
    if (!block || typeof block !== "object") continue;

    const node = block as Record<string, unknown>;
    if (!typeOf(node).some((type) => BUSINESS_TYPES.includes(type))) continue;

    const logo = textOf(node.logo);
    const url = logo ? absolute(logo) : null;

    // Het kantoor heeft dit zelf als zijn logo aangewezen; beter wordt het niet.
    if (url) return signal(url, "schema-org", 0.9);
  }

  // Een `<img>` waar "logo" in staat is bijna altijd het logo, en anders is het
  // in elk geval iets uit de kop van de site.
  const inline = /<img[^>]+(?:class|id|alt|src)=["'][^"']*logo[^"']*["'][^>]*>/i.exec(html)?.[0];
  const src = inline ? /src=["']([^"']+)["']/i.exec(inline)?.[1] : null;
  const fromImg = src ? absolute(src) : null;

  if (fromImg) return signal(fromImg, "tekst", 0.6);

  for (const rel of ["apple-touch-icon", "icon"]) {
    const href = readLinkHref(html, rel);
    const url = href ? absolute(href) : null;

    // Een favicon is het logo in het klein: vaak bruikbaar, soms alleen een
    // letter. Vandaar de lagere zekerheid.
    if (url) return signal(url, "link", 0.4);
  }

  return null;
}

/* -------------------------------------------------------------------------
 * Lettertype
 * ---------------------------------------------------------------------- */

/**
 * Welke van onze vijf lettertypes het dichtst in de buurt komt.
 *
 * Meer dan dit kan niet: `fontId` is een keuze uit vijf, en de video rendert
 * met een bestand dat wij meeleveren. Wat we wél kunnen zien is of de site
 * schreef of schreefloos is, en dat is het verschil dat op een eindkaart
 * opvalt. Een exacte match op naam pakken we mee als hij er is.
 */
const FONT_BY_NAME: Record<string, BrandFontId> = {
  inter: "inter",
  "dm sans": "dm-sans",
  "space grotesk": "space-grotesk",
  "source serif": "source-serif",
  "source serif 4": "source-serif",
  "libre baskerville": "libre-baskerville",
};

const SERIF_HINTS = ["serif", "georgia", "times", "garamond", "playfair", "merriweather", "lora"];

export function readFont(html: string, css: string): Signal<BrandFontId> | null {
  const source = `${html}\n${css}`;

  // Google Fonts zegt het duidelijkst welk lettertype iemand gekozen heeft.
  const families = [
    ...source.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi),
  ].map((match) => decodeURIComponent(match[1] ?? "").replace(/\+/g, " ").split(":")[0] ?? "");

  const declared = [...source.matchAll(/font-family\s*:\s*([^;}"']+)/gi)].map(
    (match) => match[1] ?? "",
  );

  for (const family of families) {
    const exact = FONT_BY_NAME[family.trim().toLowerCase()];
    if (exact) return signal(exact, "link", 0.9);
  }

  const haystack = [...families, ...declared].join(" ").toLowerCase();

  for (const [name, id] of Object.entries(FONT_BY_NAME)) {
    if (haystack.includes(name)) return signal(id, "stylesheet", 0.8);
  }

  if (SERIF_HINTS.some((hint) => haystack.includes(hint))) {
    // Geen naam die we kennen, wel duidelijk een schreefletter.
    return signal("source-serif", "stylesheet", 0.45);
  }

  if (haystack.trim()) return signal("inter", "stylesheet", 0.3);

  return null;
}

/** Diensten die alleen lettertypes serveren; hun CSS bevat geen merkkleuren. */
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "use.typekit.net", "use.fontawesome.com"];

/**
 * De adressen van de stylesheets van deze pagina, absoluut gemaakt.
 *
 * Eerst die van het kantoor zelf, dan de rest. Dat onderscheid kwam uit de
 * eerste echte site: die serveert zijn CSS vanaf `assets.immoweb.be` terwijl de
 * pagina op `www.immoweb.be` staat, en een filter op exact dezelfde hostnaam
 * gooide precies de stylesheet weg waar de kleuren in stonden. Een CDN-adres is
 * dus geen reden om over te slaan — alleen om achteraan te zetten.
 *
 * Dit is een keuze over budget en niet over veiligheid: elk adres hieronder
 * gaat alsnog door dezelfde keuring als de pagina zelf (zie `net.ts`).
 */
export function readStylesheetUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const pattern = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;

  for (const tag of html.matchAll(pattern)) {
    const href = /href=["']([^"']+)["']/i.exec(tag[0])?.[1];
    if (!href) continue;

    try {
      const url = new URL(href, baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;

      // Lettertypediensten eruit: die zeggen niets over de kleuren, en het
      // budget van drie bestanden hoort naar de CSS van het kantoor te gaan.
      // De naam van het lettertype halen we toch al uit de `<link>` zelf.
      if (FONT_HOSTS.some((host) => url.host.endsWith(host))) continue;

      urls.push(url.href);
    } catch {
      // Een href die geen adres is, slaan we over.
    }
  }

  // Volgorde is hier belangrijker dan het lijkt. Eén van de sites die we
  // probeerden heeft veertien stylesheets, en de eerste drie waren
  // `bootstrap.css`, `k2.css` en `consent.css` — drie bestanden vol grijstinten
  // van iemand anders, terwijl het thema van het kantoor er niet bij zat. Dus:
  // bekende bibliotheken achteraan, eigen domein vooraan.
  const eigen = registrableDomain(new URL(baseUrl).host);

  return urls
    .map((url) => ({
      url,
      score:
        (registrableDomain(new URL(url).host) === eigen ? 0 : 2) +
        (isLibrary(url) ? 1 : 0),
    }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.url);
}

/**
 * Stylesheets die op duizend sites hetzelfde zijn.
 *
 * Ze worden niet weggegooid — soms is er niets anders — maar ze gaan achteraan
 * in de rij. De kleuren van een kantoor staan in het bestand dat naar hun thema
 * heet, niet in de reset van een framework.
 */
const LIBRARY_HINTS = [
  "bootstrap",
  "foundation",
  "normalize",
  "reset",
  "fontawesome",
  "font-awesome",
  "cookieconsent",
  "cookie-consent",
  "com_k2",
  "jquery",
  "slick",
  "swiper",
  "owl.carousel",
  "magnific",
  "lightbox",
  "animate",
  "/ie.css",
];

function isLibrary(url: string): boolean {
  const path = url.toLowerCase();

  return LIBRARY_HINTS.some((hint) => path.includes(hint));
}

/**
 * `assets.immoweb.be` en `www.immoweb.be` horen bij elkaar.
 *
 * De laatste twee labels, en drie bij een samengestelde landcode als
 * `co.uk`. Geen volledige lijst van publieke achtervoegsels: die is een
 * afhankelijkheid van een megabyte, en dit wordt alleen gebruikt om te sorteren
 * — een misser kost hoogstens een verkeerde volgorde.
 */
function registrableDomain(host: string): string {
  const labels = host.toLowerCase().split(".");
  const tweeledig = ["co", "com", "net", "org", "gov", "ac"];

  if (labels.length > 2 && tweeledig.includes(labels[labels.length - 2] ?? "")) {
    return labels.slice(-3).join(".");
  }

  return labels.slice(-2).join(".");
}
