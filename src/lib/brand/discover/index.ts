import { hasEnoughContrast } from "@/lib/brand/colors";
import {
  pickColors,
  readContact,
  readFont,
  readLogoCandidates,
  readStylesheetUrls,
  type Signal,
} from "@/lib/brand/discover/extract";
import { fetchPublicPage, UnreachableSiteError } from "@/lib/brand/discover/net";
import { createLogger } from "@/lib/errors/logger";
import type { BrandFontId } from "@/types";

const log = createLogger("brand");

/**
 * De huisstijl van een kantoor voorstellen op basis van hun eigen website.
 *
 * **Een voorstel en geen automaat.** Elk veld komt terug met de bron en een
 * mate van zekerheid, en het scherm laat de gebruiker kiezen wat hij overneemt.
 * Dat is niet uit voorzichtigheid: een kleur die er in zeven van de tien
 * gevallen goed uitziet is prachtig als suggestie en onbruikbaar als iets dat
 * stilletjes gebeurt — de drie andere kantoren zien hun video in de verkeerde
 * kleur en weten niet waarom.
 *
 * Wat er niet uit komt, is even belangrijk als wat er wel uit komt. `outroText`
 * en `ctaText` staan nergens in een broncode: dat zijn zinnen die iemand
 * bedacht heeft. Het lettertype wordt een keuze uit onze eigen vijf, want de
 * render gebruikt een bestand dat wij meeleveren.
 */

export type BrandSuggestion = {
  /** Waar we uiteindelijk gekeken hebben; kan afwijken door een omleiding. */
  url: string;
  primaryColor: Signal<string> | null;
  secondaryColor: Signal<string> | null;
  logoUrl: Signal<string> | null;
  fontId: Signal<BrandFontId> | null;
  agentName: Signal<string> | null;
  phone: Signal<string> | null;
  email: Signal<string> | null;
  /** Reserveadressen voor het logo; het eerste dat een echte afbeelding is, wint. */
  logoAlternatieven: string[];
  /** Zinnen voor de gebruiker over wat er niet gelukt is. */
  notes: string[];
};

/**
 * Hoeveel stylesheets we erbij halen.
 *
 * Vijf en niet drie, omdat een echte site er veertien blijkt te hebben: een
 * Joomla-kantoor met een thema van zijn CMS-leverancier verdeelt zijn CSS over
 * `default.css`, `template.css`, `layout.css` en nog een handvol. Met drie
 * bestanden mis je de helft van de kleuren. Het budget per bestand gaat omlaag
 * zodat het totaal niet groeit.
 */
const MAX_STYLESHEETS = 5;
const STYLESHEET_MAX_BYTES = 300 * 1024;

/**
 * Hoe een pagina binnenkomt.
 *
 * Los mee te geven zodat een test de hele samenvoeging kan draaien zonder
 * netwerk. De standaard is en blijft de beveiligde ophaler: wie hier iets
 * anders in stopt, doet dat in een test en niet in een route — de beveiliging
 * zit in `net.ts` en gaat er niet uit om iets makkelijker te maken.
 */
export type PageFetcher = typeof fetchPublicPage;

export async function discoverBrandKit(
  rawUrl: string,
  fetchPage: PageFetcher = fetchPublicPage,
): Promise<BrandSuggestion> {
  const page = await fetchPage(rawUrl);
  const css = await collectStylesheets(page.html, page.url, fetchPage);

  const colors = pickColors(page.html, css);
  const logoKandidaten = readLogoCandidates(page.html, page.url);
  const contact = readContact(page.html);
  const notes: string[] = [];

  if (!colors.primary) {
    notes.push(
      "We vonden geen duidelijke merkkleur. Op sommige sites staan de kleuren in een afbeelding of in JavaScript, en daar kunnen we niet in kijken.",
    );
  }

  // De eindkaart zet witte of donkere tekst op de hoofdkleur. Een kleur die het
  // daar niet doet, is geen bruikbare huisstijl — beter nu gezegd dan straks
  // ontdekt in een gerenderde video.
  if (colors.primary && !hasEnoughContrast(colors.primary.value, "#ffffff")) {
    notes.push(
      `De gevonden kleur ${colors.primary.value} is licht: op de eindkaart komt daar donkere tekst op te staan.`,
    );
  }

  if (colors.note) notes.push(colors.note);

  if (css === "" && !colors.primary) {
    notes.push("De stylesheets van deze site waren niet leesbaar voor ons.");
  }

  const suggestion: BrandSuggestion = {
    url: page.url,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    logoUrl: logoKandidaten[0] ?? null,
    logoAlternatieven: logoKandidaten.slice(1, 4).map((kandidaat) => kandidaat.value),
    fontId: readFont(page.html, css),
    agentName: contact.agentName,
    phone: contact.phone,
    email: contact.email,
    notes,
  };

  log.info("huisstijl voorgesteld", {
    url: page.url,
    gevonden: Object.entries(suggestion)
      .filter(([key, value]) => key !== "url" && key !== "notes" && value !== null)
      .map(([key]) => key)
      .join(", "),
  });

  return suggestion;
}

/**
 * De stylesheets van de pagina, achter elkaar geplakt.
 *
 * Eén die niet laadt, maakt de andere niet stuk: een huisstijl uit de helft van
 * de CSS is beter dan een foutmelding. Ze gaan door dezelfde beveiligde
 * ophaler als de pagina zelf — een stylesheet-adres komt van de site en is dus
 * net zo goed van buiten.
 */
async function collectStylesheets(
  html: string,
  baseUrl: string,
  fetchPage: PageFetcher,
): Promise<string> {
  const urls = readStylesheetUrls(html, baseUrl).slice(0, MAX_STYLESHEETS);
  const sheets: string[] = [];

  for (const url of urls) {
    try {
      const sheet = await fetchPage(url, {
        maxBytes: STYLESHEET_MAX_BYTES,
        accept: "text/css,*/*;q=0.1",
      });

      sheets.push(sheet.html);
    } catch (error) {
      log.debug("stylesheet overgeslagen", {
        url,
        reden: error instanceof UnreachableSiteError ? error.reason : "onbekend",
      });
    }
  }

  return sheets.join("\n");
}
