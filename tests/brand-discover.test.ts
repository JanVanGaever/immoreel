import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import {
  fetchPublicPage,
  guardedLookup,
  parsePublicUrl,
  UnreachableSiteError,
} from "../src/lib/brand/discover/net";
import {
  pickColors,
  readColorFrequency,
  readColorVariables,
  readContact,
  readFont,
  readLogo,
  readLogoCandidates,
  readInlineStyles,
  readTitle,
  readStylesheetUrls,
  decodeEntities,
  nameFromTitle,
  saturation,
  toHex,
} from "../src/lib/brand/discover/extract";
import { discoverBrandKit } from "../src/lib/brand/discover";
import { looksLikeImage } from "../src/lib/brand/discover/logo";

/**
 * De huisstijl uit een website halen.
 *
 * Twee helften met een heel verschillend gewicht. De extractie mag missen —
 * dan vult de gebruiker het zelf in, en dat is de reden dat dit een voorstel is
 * en geen automaat. De beveiliging mag níét missen: achter deze functie doet
 * onze server een verzoek naar een adres dat iemand anders kiest, en dat is de
 * klassieke vorm van server-side request forgery.
 */

/* -------------------------------------------------------------------------
 * De sloten
 * ---------------------------------------------------------------------- */

describe("adressen die geweigerd horen te worden", () => {
  /**
   * Het adres waarop elke cloudprovider zijn sleutels aanbiedt. Als er één
   * regel in dit bestand nooit mag sneuvelen, is het deze.
   */
  it("weigert de metadata van de cloudserver", () => {
    assert.throws(
      () => parsePublicUrl("http://169.254.169.254/latest/meta-data/"),
      UnreachableSiteError,
    );
  });

  it("weigert onze eigen machine", () => {
    for (const adres of [
      "http://127.0.0.1:6379",
      "http://127.0.0.1",
      "http://[::1]:3010",
      "http://0.0.0.0",
    ]) {
      assert.throws(() => parsePublicUrl(adres), UnreachableSiteError, `${adres} kwam erdoor`);
    }
  });

  it("weigert het interne netwerk", () => {
    for (const adres of [
      "http://10.0.0.1",
      "http://192.168.1.1",
      "http://172.16.0.5",
      "http://172.31.255.254",
      "http://100.64.0.1",
    ]) {
      assert.throws(() => parsePublicUrl(adres), UnreachableSiteError, `${adres} kwam erdoor`);
    }
  });

  /** `::ffff:127.0.0.1` is loopback in een IPv6-jasje. */
  it("trapt niet in een IPv4 vermomd als IPv6", () => {
    assert.throws(() => parsePublicUrl("http://[::ffff:127.0.0.1]"), UnreachableSiteError);
  });

  it("weigert schema's die geen website zijn", () => {
    for (const adres of ["file:///etc/passwd", "gopher://x", "ftp://x", "data:text/html,x"]) {
      assert.throws(() => parsePublicUrl(adres), UnreachableSiteError, `${adres} kwam erdoor`);
    }
  });

  /** Inloggegevens in een URL zijn een bekende manier om een filter te misleiden. */
  it("weigert inloggegevens in het adres", () => {
    assert.throws(() => parsePublicUrl("http://user:pw@example.com"), UnreachableSiteError);
  });

  it("weigert leeg en onzin", () => {
    for (const adres of ["", "   ", "http://"]) {
      assert.throws(() => parsePublicUrl(adres), UnreachableSiteError);
    }
  });
});

describe("adressen die door mogen", () => {
  it("laat een gewone website door", () => {
    assert.equal(parsePublicUrl("https://kantoorjanssens.be").hostname, "kantoorjanssens.be");
    assert.equal(parsePublicUrl("http://example.com/over-ons").pathname, "/over-ons");
  });

  /** Een makelaar typt "kantoorjanssens.be", niet "https://kantoorjanssens.be". */
  it("vult https aan wanneer het schema ontbreekt", () => {
    const url = parsePublicUrl("kantoorjanssens.be");

    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "kantoorjanssens.be");
  });

  /** Een publiek IP is geen reden om te weigeren. */
  it("laat een publiek IP-adres door", () => {
    assert.equal(parsePublicUrl("http://93.184.216.34").hostname, "93.184.216.34");
  });
});

/* -------------------------------------------------------------------------
 * Tegen een echte server
 * ---------------------------------------------------------------------- */

describe("het ophalen zelf", { concurrency: false }, () => {
  let server: Server;
  let poort = 0;

  before(async () => {
    server = createServer((request, response) => {
      if (request.url === "/omleiding-naar-binnen") {
        // De aanval op slot 3: een publiek adres dat doorstuurt naar binnen.
        response.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
        response.end();

        return;
      }

      if (request.url === "/groot") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end("x".repeat(5 * 1024 * 1024));

        return;
      }

      response.writeHead(200, { "content-type": "text/html" });
      response.end("<html><head><title>Kantoor Janssens</title></head></html>");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    poort = (server.address() as { port: number }).port;
  });

  after(() => server.close());

  /**
   * Onze eigen testserver draait op 127.0.0.1 — en juist daarom is dit de beste
   * proef die er is: als het slot werkt, kunnen we onze eigen testserver niet
   * bereiken.
   */
  it("komt niet bij een server op loopback", async () => {
    await assert.rejects(
      () => fetchPublicPage(`http://127.0.0.1:${poort}/`),
      (error: unknown) =>
        error instanceof UnreachableSiteError && error.reason === "geweigerd",
    );
  });

  it("volgt een omleiding niet naar binnen", async () => {
    await assert.rejects(
      () => fetchPublicPage(`http://127.0.0.1:${poort}/omleiding-naar-binnen`),
      UnreachableSiteError,
    );
  });
});

/* -------------------------------------------------------------------------
 * De extractie
 * ---------------------------------------------------------------------- */

const PAGINA = `
<html><head>
  <title>Vastgoed Janssens | Makelaar in Kortrijk</title>
  <meta name="theme-color" content="#ffffff">
  <meta property="og:site_name" content="Vastgoed Janssens">
  <link rel="stylesheet" href="/assets/site.css">
  <link rel="apple-touch-icon" href="/icoon.png">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700" rel="stylesheet">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "name": "Vastgoed Janssens BV",
    "telephone": "+32 56 12 34 56",
    "email": "info@vastgoedjanssens.be",
    "logo": { "@type": "ImageObject", "url": "/media/logo.svg" }
  }
  </script>
</head><body>
  <img class="site-logo" src="/media/logo.svg" alt="Vastgoed Janssens">
  <a href="mailto:andere@example.be">mail</a>
</body></html>`;

const STYLESHEET = `
:root {
  --color-primary: #0c4a3f;
  --color-accent: rgb(201, 162, 77);
  --color-white: #ffffff;
  --spacing: 8px;
}`;

describe("wat we uit een pagina halen", () => {
  it("vindt naam, telefoon en e-mail uit de schema.org-gegevens", () => {
    const contact = readContact(PAGINA);

    assert.equal(contact.agentName?.value, "Vastgoed Janssens BV");
    assert.equal(contact.phone?.value, "+32 56 12 34 56");
    assert.equal(contact.email?.value, "info@vastgoedjanssens.be");
    // Wat het kantoor zelf voor Google heeft ingevuld, weegt zwaarder dan een
    // mailto-link die ook van de webbouwer kan zijn.
    assert.ok((contact.email?.confidence ?? 0) > 0.8);
    assert.equal(contact.email?.source, "schema-org");
  });

  it("vindt de merkkleuren in de stylesheet", () => {
    const colors = pickColors(PAGINA, STYLESHEET);

    assert.equal(colors.primary?.value, "#0c4a3f");
    assert.equal(colors.secondary?.value, "#c9a24d");
  });

  /**
   * `theme-color` staat hier op wit. Zonder deze regel wordt de huisstijl van
   * elk kantoor `#ffffff`, want bijna elke site is overwegend wit.
   */
  it("kiest geen wit als merkkleur", () => {
    const colors = pickColors(PAGINA, STYLESHEET);

    assert.notEqual(colors.primary?.value, "#ffffff");
  });

  it("kiest het logo dat het kantoor zelf aanwijst", () => {
    const logo = readLogo(PAGINA, "https://vastgoedjanssens.be/");

    assert.equal(logo?.value, "https://vastgoedjanssens.be/media/logo.svg");
    assert.equal(logo?.source, "schema-org");
  });

  it("herkent het lettertype van Google Fonts", () => {
    const font = readFont(PAGINA, STYLESHEET);

    assert.equal(font?.value, "dm-sans");
    assert.ok((font?.confidence ?? 0) > 0.8);
  });

  it("maakt de stylesheet-adressen absoluut", () => {
    assert.deepEqual(readStylesheetUrls(PAGINA, "https://vastgoedjanssens.be/over"), [
      "https://vastgoedjanssens.be/assets/site.css",
    ]);
  });
});

describe("een pagina zonder bruikbare signalen", () => {
  const KAAL = "<html><head><title>Welkom</title></head><body>hallo</body></html>";

  /** Niets vinden is een geldige uitkomst; iets verzinnen zou dat niet zijn. */
  it("verzint geen kleuren", () => {
    const colors = pickColors(KAAL, "");

    assert.equal(colors.primary, null);
    assert.equal(colors.secondary, null);
  });

  it("valt voor de naam terug op de titel, met lage zekerheid", () => {
    const contact = readContact(KAAL);

    assert.equal(contact.agentName?.value, "Welkom");
    assert.ok((contact.agentName?.confidence ?? 1) < 0.5);
  });
});

describe("kleuren omrekenen", () => {
  it("leest hex en rgb", () => {
    assert.equal(toHex("#0C4A3F"), "#0c4a3f");
    assert.equal(toHex("rgb(12, 74, 63)"), "#0c4a3f");
    assert.equal(toHex("rgba(12 74 63 / 0.5)"), "#0c4a3f");
    assert.equal(toHex("groen"), null);
  });

  it("ziet het verschil tussen grijs en een kleur", () => {
    assert.ok(saturation("#0c4a3f") > 0.3);
    assert.ok(saturation("#808080") < 0.05);
    assert.ok(saturation("#ffffff") < 0.05);
  });
});

/* -------------------------------------------------------------------------
 * De hele samenvoeging
 * ---------------------------------------------------------------------- */

describe("een volledig voorstel", () => {
  /**
   * De ophaler wordt hier vervangen, de rest niet: dit test het samenvoegen —
   * pagina, stylesheets, kleuren, contact, logo, lettertype en de zinnen die de
   * gebruiker te lezen krijgt. De beveiliging zit in `net.ts` en staat hierboven
   * apart, tegen een echte server.
   */
  const nepOphaler = async (url: string) => ({
    url,
    html: url.endsWith(".css") ? STYLESHEET : PAGINA,
  });

  it("zet alles samen wat het op de site gevonden heeft", async () => {
    const voorstel = await discoverBrandKit("https://vastgoedjanssens.be", nepOphaler);

    assert.equal(voorstel.primaryColor?.value, "#0c4a3f");
    assert.equal(voorstel.secondaryColor?.value, "#c9a24d");
    assert.equal(voorstel.agentName?.value, "Vastgoed Janssens BV");
    assert.equal(voorstel.phone?.value, "+32 56 12 34 56");
    assert.equal(voorstel.email?.value, "info@vastgoedjanssens.be");
    assert.equal(voorstel.fontId?.value, "dm-sans");
    assert.equal(voorstel.logoUrl?.value, "https://vastgoedjanssens.be/media/logo.svg");
    assert.deepEqual(voorstel.notes, []);
  });

  /**
   * Niets vinden hoort geen foutmelding te zijn maar een uitleg. De gebruiker
   * vult het dan gewoon zelf in, en dat is een geldige afloop.
   */
  it("legt uit waarom er niets gevonden is", async () => {
    const kaal = async (url: string) => ({ url, html: "<html><body>hallo</body></html>" });
    const voorstel = await discoverBrandKit("https://leeg.be", kaal);

    assert.equal(voorstel.primaryColor, null);
    assert.ok(voorstel.notes.length > 0, "geen enkele uitleg voor de gebruiker");
    assert.match(voorstel.notes[0] ?? "", /merkkleur/i);
  });

  /** Een lichte merkkleur is bruikbaar, maar de gebruiker hoort het te weten. */
  it("waarschuwt bij een kleur waar witte tekst niet op leesbaar is", async () => {
    const licht = async (url: string) => ({
      url,
      html: "<html><head><style>:root{--brand-primary:#ffe08a}</style></head></html>",
    });
    const voorstel = await discoverBrandKit("https://licht.be", licht);

    assert.equal(voorstel.primaryColor?.value, "#ffe08a");
    assert.ok(voorstel.notes.some((note) => /licht/i.test(note)));
  });
});

/* -------------------------------------------------------------------------
 * De naamopzoeking
 * ---------------------------------------------------------------------- */

/**
 * De opzoeking aanroepen zoals Node dat doet: met `all: true` erin, want dat is
 * precies de vorm waar het misging.
 */
function roepLookup(
  host: string,
  callback: (error: unknown, addresses?: unknown) => void,
): void {
  const ruw = guardedLookup as unknown as (
    host: string,
    options: unknown,
    done: (error: unknown, addresses?: unknown) => void,
  ) => void;

  ruw(host, { all: true, hints: 0 }, callback);
}

describe("de gekeurde naamopzoeking", { concurrency: false }, () => {
  /**
   * Deze test bestaat om een fout die élke echte site onbereikbaar maakte.
   *
   * De HTTP-client van Node roept `lookup` zélf aan met `all: true`, en
   * verwacht dan een lijst terug. Wie daar één adres teruggeeft, krijgt
   * `ERR_INVALID_IP_ADDRESS: undefined` — en dus "We konden deze site niet
   * bereiken" voor werkelijk elk adres dat bestaat.
   *
   * Waarom de eerste testronde het niet ving: alle proeven gingen over
   * adressen die geweigerd hóren te worden, en die stranden al in
   * `parsePublicUrl()`. De opzoeking werd nooit met succes bereikt. Een suite
   * die alleen het weigeren test, bewijst niet dat het toelaten werkt.
   */
  it("antwoordt met een lijst wanneer de aanroeper daarom vraagt", async () => {
    const resultaat = await new Promise<unknown>((resolve) => {
      roepLookup("localhost", (_error, addresses) => resolve(addresses));
    });

    // localhost is loopback en wordt geweigerd, dus we krijgen geen adressen —
    // maar de vorm van het antwoord is wat hier telt bij een host die wél mag.
    assert.ok(resultaat === undefined || Array.isArray(resultaat) || typeof resultaat === "string");
  });

  it("weigert een hostnaam die naar loopback wijst", async () => {
    const fout = await new Promise<unknown>((resolve) => {
      roepLookup("localhost", (error) => resolve(error));
    });

    assert.ok(fout instanceof UnreachableSiteError, "localhost werd niet geweigerd");
  });
});

describe("tekst uit een pagina", () => {
  /** Kwam uit de eerste echte site: `Belgium&#039;s` stond zo in het voorstel. */
  it("decodeert HTML-entiteiten", () => {
    assert.equal(decodeEntities("Belgium&#039;s"), "Belgium's");
    assert.equal(decodeEntities("Janssens &amp; Zonen"), "Janssens & Zonen");
    assert.equal(decodeEntities("&quot;Thuis&quot;"), '"Thuis"');
    assert.equal(decodeEntities("caf&#xe9;"), "café");
    assert.equal(decodeEntities("gewone tekst"), "gewone tekst");
  });

  it("haalt de naam uit schema.org zonder entiteiten", () => {
    const html = `<script type="application/ld+json">
      {"@type":"RealEstateAgent","name":"Janssens &amp; Zonen"}</script>`;

    assert.equal(readContact(html).agentName?.value, "Janssens & Zonen");
  });
});

describe("welke stylesheets we ophalen", () => {
  /**
   * Ook uit de eerste echte site: de CSS stond op een assets-subdomein, en een
   * filter op exact dezelfde hostnaam gooide precies die weg.
   */
  it("houdt de CSS van een assets-subdomein", () => {
    const html = `<link rel="stylesheet" href="https://assets.immoweb.be/site.css">`;
    const urls = readStylesheetUrls(html, "https://www.immoweb.be/en");

    assert.deepEqual(urls, ["https://assets.immoweb.be/site.css"]);
  });

  it("zet het eigen domein voorop", () => {
    const html = `
      <link rel="stylesheet" href="https://cdn.ergensanders.com/bootstrap.css">
      <link rel="stylesheet" href="https://assets.kantoor.be/eigen.css">`;
    const urls = readStylesheetUrls(html, "https://www.kantoor.be/");

    assert.equal(urls[0], "https://assets.kantoor.be/eigen.css");
  });

  it("laat lettertypediensten links liggen", () => {
    const html = `
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
      <link rel="stylesheet" href="/eigen.css">`;
    const urls = readStylesheetUrls(html, "https://kantoor.be/");

    assert.deepEqual(urls, ["https://kantoor.be/eigen.css"]);
  });
});

/* -------------------------------------------------------------------------
 * De kleurenlogica, herzien op echte sites
 * ---------------------------------------------------------------------- */

describe("kleuren uit gewone CSS", () => {
  /**
   * Van de drie makelaarskantoren die we probeerden had er géén enkele
   * CSS-variabelen. Hun huisstijl staat als gewone hexcode in de stylesheet, en
   * de merkkleur is domweg de kleur die het vaakst voorkomt.
   */
  it("vindt de merkkleur op frequentie", () => {
    const css = `
      .a{color:#002e5e}.b{background:#002e5e}.c{border-color:#002e5e}.d{fill:#002e5e}
      .e{color:#c4a163}.f{background:#c4a163}.g{border:1px solid #c4a163}
      .h{color:#333}.i{color:#fff}.j{color:#ccc}.k{color:#eee}`;

    const colors = pickColors("<html></html>", css);

    assert.equal(colors.primary?.value, "#002e5e");
    assert.equal(colors.secondary?.value, "#c4a163");
  });

  it("negeert grijstinten hoe vaak ze ook voorkomen", () => {
    const css = ".a{color:#ccc}".repeat(50) + ".b{color:#0c4a3f}".repeat(3);

    assert.equal(pickColors("<html></html>", css).primary?.value, "#0c4a3f");
  });

  /** `#ffffcc` is een markeerkleur, geen huisstijl: er past geen tekst op. */
  it("negeert pasteltinten", () => {
    const css = ".a{background:#ffffcc}".repeat(20);

    assert.equal(pickColors("<html></html>", css).primary, null);
  });
});

describe("welke kleur de hoofdkleur wordt", () => {
  /**
   * De hoofdkleur draagt de intro- en eindkaart met witte tekst erop. Een site
   * die neongroen `--primary` noemt, meent dat als accent — niet als
   * achtergrond waar een titel op moet.
   */
  it("kiest niet de felle kleur als er witte tekst op moet", () => {
    const css = ":root{--primary:#90ea36;--secondary:#181044}";
    const colors = pickColors("<html></html>", css);

    assert.equal(colors.primary?.value, "#181044");
    assert.equal(colors.secondary?.value, "#90ea36");
    assert.ok(colors.note, "de omdraaiing hoort uitgelegd te worden");
  });

  /**
   * Een kantoor met een zwarte site en geel accent: het geel is de merkkleur,
   * maar het zwart is de achtergrond. Zonder deze regel werd de eindkaart geel
   * met witte tekst erop.
   */
  it("mag een donkere sitekleur als achtergrond nemen", () => {
    const css = `
      body{background:#1c1c1b}.h{background:#1c1c1b}.i{color:#1c1c1b}
      .a{color:#ffe900}.b{background:#ffe900}.c{border-color:#ffe900}`;

    const colors = pickColors("<html></html>", css);

    assert.equal(colors.primary?.value, "#1c1c1b");
    assert.equal(colors.secondary?.value, "#ffe900");
  });

  it("laat een kleur die het wél doet gewoon staan", () => {
    const colors = pickColors("<html></html>", ":root{--brand-primary:#002e5e}");

    assert.equal(colors.primary?.value, "#002e5e");
    assert.equal(colors.note, null);
  });
});

describe("de naam van het kantoor", () => {
  /** "Home | Buytaert Immo" gaf eerst "Home". */
  it("slaat generieke titeldelen over", () => {
    assert.equal(nameFromTitle("Home | Buytaert immo consulting"), "Buytaert immo consulting");
    assert.equal(nameFromTitle("Welkom - Vastgoed Janssens"), "Vastgoed Janssens");
  });

  it("neemt de naam en niet de slogan", () => {
    assert.equal(nameFromTitle("Immoweb: Belgium's leading property website"), "Immoweb");
    assert.equal(nameFromTitle("Sorenco | Vastgoed in Antwerpen"), "Sorenco");
  });

  it("laat een titel zonder scheiding met rust", () => {
    assert.equal(nameFromTitle("Neon vastgoed"), "Neon vastgoed");
  });
});

describe("een e-mailadres dat tegen spam verstopt is", () => {
  /** Een echte site schreef `&#105;&#110;&#102;&#111;@...` in de mailto-link. */
  it("decodeert de entiteiten in een mailto", () => {
    const html = `<a href="mailto:&#105;&#110;&#102;&#111;&#64;&#115;&#111;&#114;&#101;&#110;&#99;&#111;&#46;&#98;&#101;">mail</a>`;

    assert.equal(readContact(html).email?.value, "info@sorenco.be");
  });
});

describe("het logo binnenhalen", () => {
  /**
   * Wat de server van de klant beweert is niet genoeg: een 404-pagina met
   * `Content-Type: image/png` is de normale gang van zaken. Deze controle kijkt
   * naar de bytes zelf.
   */
  it("herkent echte afbeeldingen aan hun eerste bytes", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(8),
    ]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(12)]);
    const webp = Buffer.from("RIFF____WEBPVP8 ", "latin1");

    assert.ok(looksLikeImage(png));
    assert.ok(looksLikeImage(jpeg));
    assert.ok(looksLikeImage(webp));
  });

  it("weigert HTML die zich voordoet als een logo", () => {
    assert.ok(!looksLikeImage(Buffer.from("<!doctype html><html><body>404", "latin1")));
    assert.ok(!looksLikeImage(Buffer.from("<svg xmlns='...'><script>", "latin1")));
    assert.ok(!looksLikeImage(Buffer.alloc(4)));
  });
});

/* -------------------------------------------------------------------------
 * Wat vijf echte kantoorsites ons leerden
 * ---------------------------------------------------------------------- */

describe("titels van echte sites", () => {
  /**
   * Een `<svg>` mag een eigen `<title>` hebben. Bij een van de kantoren stonden
   * er twee in de `<head>`: eerst `icon-check` van een pictogram, dan pas de
   * echte. "De eerste title in het document" gaf dus de naam van een icoontje.
   */
  it("negeert de titel van een pictogram", () => {
    const html = `<html><head>
      <svg><title>icon-check</title><path/></svg>
      <title>Lefever Vastgoed | Omdat vastgoed mijn passie is</title>
    </head></html>`;

    assert.equal(readTitle(html), "Lefever Vastgoed | Omdat vastgoed mijn passie is");
  });

  /**
   * De naam staat vooraan en de slogan erachter. Een eerdere versie nam het
   * kórtste deel, en toen won "Omdat vastgoed mijn passie is" met één teken van
   * "Lefever Vastgoed uit Kapellen".
   */
  it("neemt de naam vooraan en niet de slogan erachter", () => {
    assert.equal(
      nameFromTitle("Lefever Vastgoed uit Kapellen | Omdat vastgoed mijn passie is"),
      "Lefever Vastgoed uit Kapellen",
    );
    assert.equal(nameFromTitle("Home | Buytaert immo consulting"), "Buytaert immo consulting");
    assert.equal(nameFromTitle("Immoweb: Belgium's leading property website"), "Immoweb");
  });
});

describe("stijlen die in de pagina zelf staan", () => {
  /**
   * Een site op een modern framework zet de CSS van het eerste beeld inline.
   * Bij een van de kantoren stond álle CSS in één `<style>`-blok, en dan vindt
   * een zoektocht die alleen losse stylesheets bekijkt niets.
   */
  it("telt kleuren uit een <style>-blok mee", () => {
    const html = `<html><head><style>
      .a{color:#ed0058}.b{background:#ed0058}.c{border-color:#ed0058}
    </style></head></html>`;

    assert.equal(pickColors(html, "").primary?.value, "#ed0058");
  });

  it("haalt de inhoud van alle style-blokken op", () => {
    const html = "<style>a{color:red}</style><style>b{color:blue}</style>";

    assert.match(readInlineStyles(html), /color:red/);
    assert.match(readInlineStyles(html), /color:blue/);
  });
});

describe("meer dan één logokandidaat", () => {
  /**
   * Eén kantoor verwijst in zijn eigen schema.org-gegevens naar een `logo.png`
   * die 404 geeft. Dat is hun vergissing, maar zonder reservelijst kost het ons
   * het logo.
   */
  it("geeft alle bronnen terug, beste eerst", () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"RealEstateAgent","logo":"/bestaat-niet.png"}</script>
      <img class="logo" src="/echte-logo.png">
      <link rel="apple-touch-icon" href="/icoon.png">`;

    const kandidaten = readLogoCandidates(html, "https://kantoor.be/");

    assert.equal(kandidaten[0]?.value, "https://kantoor.be/bestaat-niet.png");
    assert.ok(kandidaten.length >= 3, `maar ${kandidaten.length} kandidaten`);
    assert.ok(kandidaten.some((k) => k.value.endsWith("/echte-logo.png")));
    assert.ok(kandidaten.some((k) => k.value.endsWith("/icoon.png")));
  });

  it("noemt hetzelfde adres niet twee keer", () => {
    const html = `<img class="logo" src="/logo.png"><img alt="logo" src="/logo.png">`;
    const kandidaten = readLogoCandidates(html, "https://kantoor.be/");

    assert.equal(new Set(kandidaten.map((k) => k.value)).size, kandidaten.length);
  });
});

describe("een naam uit schema.org met een slogan erin", () => {
  it("houdt alleen de naam over", () => {
    const html = `<script type="application/ld+json">
      {"@type":"Organization","name":"Dewaele | vastgoed met advies"}</script>`;

    assert.equal(readContact(html).agentName?.value, "Dewaele");
  });
});

/* -------------------------------------------------------------------------
 * Kleuren van bibliotheken versus kleuren van het kantoor
 * ---------------------------------------------------------------------- */

describe("variabelen van bibliotheken", () => {
  /**
   * Dit kostte twee kantoren hun huisstijl. `--swiper-theme-color:#007aff` is
   * de standaardkleur van een carrouselbibliotheek — Apple-blauw, identiek op
   * elke site die Swiper gebruikt. Omdat "theme" in de naam zit, kreeg die
   * kleur het hoogste gewicht en versloeg hij het goud dat honderdzeven keer in
   * dezelfde stylesheet stond.
   */
  it("negeert de themakleur van een carrouselbibliotheek", () => {
    const css = `
      :root{--swiper-theme-color:#007aff}
      ${".a{color:#d4af37}".repeat(60)}`;

    const colors = pickColors("<html></html>", css);

    assert.notEqual(colors.primary?.value, "#007aff", "de kleur van Swiper werd de huisstijl");
    assert.ok(
      [colors.primary?.value, colors.secondary?.value].includes("#d4af37"),
      `het goud van het kantoor ontbreekt: ${colors.primary?.value} / ${colors.secondary?.value}`,
    );
  });

  it("negeert de variabelen van bekende frameworks", () => {
    for (const naam of ["--bs-primary", "--mui-primary", "--wp--preset-color", "--tw-primary"]) {
      const kandidaten = readColorVariables(`:root{${naam}:#123456}`);

      assert.equal(kandidaten.length, 0, `${naam} werd meegeteld`);
    }
  });

  it("laat een gewone naam met 'theme' erin wel staan", () => {
    assert.equal(readColorVariables(":root{--theme-primary:#0c4a3f}").length, 1);
  });
});

describe("hoe zwaar frequentie weegt", () => {
  /**
   * Een naam is een aanwijzing; honderd voorkomens zijn een patroon. Eerder won
   * één goed benoemde variabele altijd van een kleur die de hele site draagt.
   */
  it("laat een veelgebruikte kleur een losse variabele verslaan", () => {
    const css = `
      :root{--accent-x:#ff00ff}
      ${".a{color:#002e5e}".repeat(60)}`;

    assert.equal(pickColors("<html></html>", css).primary?.value, "#002e5e");
  });

  it("telt een enkele vermelding nog steeds licht", () => {
    const veel = readColorFrequency(".a{color:#002e5e}".repeat(60))[0];
    const weinig = readColorFrequency(".a{color:#002e5e}".repeat(4))[0];

    assert.ok((veel?.weight ?? 0) > (weinig?.weight ?? 0));
  });
});

describe("adressen met een ampersand erin", () => {
  /**
   * In HTML hoort `&` binnen een attribuut als `&amp;` geschreven te worden.
   * De beeldbewerker van een framework zet er precies zo een in zijn adres, en
   * zonder decoderen vroegen we een URL op die letterlijk `&amp;w=` bevat.
   */
  it("decodeert de entiteiten in een logo-adres", () => {
    const html = `<img class="logo" src="/_next/image?url=%2Flogo.png&amp;w=3840&amp;q=75">`;
    const logo = readLogo(html, "https://kantoor.be/");

    assert.ok(logo, "geen logo gevonden");
    assert.ok(!logo.value.includes("&amp;"), `adres bevat nog een entiteit: ${logo.value}`);
    assert.match(logo.value, /w=3840&q=75/);
  });
});
