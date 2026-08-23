import { fetchPublicResource, UnreachableSiteError } from "@/lib/brand/discover/net";
import { createLogger } from "@/lib/errors/logger";
import { getUploadStorage } from "@/lib/uploads/storage";
import { normaliseMimeType } from "@/lib/uploads/validation";
import { API_ROUTES } from "@/lib/constants";
import type { ID } from "@/types";

const log = createLogger("brand");

/**
 * Het logo van de klant ophalen en in onze eigen opslag zetten.
 *
 * Waarom niet gewoon de URL van hun site bewaren? Drie redenen, en ze wegen
 * alle drie:
 *
 * 1. **Het verdwijnt.** Een kantoor dat volgend jaar zijn website vernieuwt,
 *    heeft ineens video's met een gebroken logo — en merkt dat pas als een
 *    klant het zegt.
 * 2. **De renderworker moet erbij.** Die draait los van de browser en haalt
 *    zijn materiaal uit de opslag, niet van het internet.
 * 3. **Het lekt.** Een logo dat bij elke weergave van hun eigen server komt,
 *    vertelt dat kantoor wie wanneer naar welke video kijkt.
 *
 * Dus: één keer binnenhalen, en daarna is het van ons.
 */

/** Wat we terugserveren kunnen — en dus wat we binnenhalen. Zie `/api/assets/:id`. */
const TOEGESTAAN = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);

/** Ruim voor een logo; hetzelfde plafond dat het uploadveld noemt. */
const MAX_BYTES = 2 * 1024 * 1024;

export type ImportedLogo = {
  url: string;
  fileName: string;
};

export class LogoImportError extends Error {
  readonly reason: "onbereikbaar" | "geen-afbeelding" | "te-groot" | "opslag";

  constructor(reason: LogoImportError["reason"], message: string) {
    super(message);
    this.name = "LogoImportError";
    this.reason = reason;
  }
}

/**
 * Het logo binnenhalen, met reserveadressen.
 *
 * De beste bron is niet altijd de werkende bron: een van de geteste kantoren
 * verwijst in zijn eigen schema.org-gegevens naar een `logo.png` die 404 geeft.
 * Dan is het `<img>` uit hun koptekst nog altijd hun logo, en dat is beter dan
 * de gebruiker met lege handen laten staan.
 */
export async function importLogoWithFallback(
  urls: readonly string[],
  organisationId: ID,
): Promise<ImportedLogo> {
  let laatste: LogoImportError | null = null;

  for (const url of urls) {
    try {
      return await importLogo(url, organisationId);
    } catch (error) {
      if (!(error instanceof LogoImportError)) throw error;

      laatste = error;
    }
  }

  throw laatste ?? new LogoImportError("onbereikbaar", "We konden geen logo ophalen.");
}

export async function importLogo(rawUrl: string, organisationId: ID): Promise<ImportedLogo> {
  let resource;

  try {
    // Dezelfde beveiligde ophaler als de pagina zelf: dit adres komt van een
    // vreemde site en is dus net zo min te vertrouwen als het adres dat de
    // klant intypte.
    resource = await fetchPublicResource(rawUrl, {
      maxBytes: MAX_BYTES,
      accept: "image/png,image/jpeg,image/webp,image/avif;q=0.9,*/*;q=0.1",
    });
  } catch (error) {
    if (error instanceof UnreachableSiteError) {
      throw new LogoImportError("onbereikbaar", "We konden dit logo niet ophalen.");
    }

    throw error;
  }

  const contentType = normaliseMimeType(resource.contentType);

  // Wat de server van de klant zegt én wat er in de bytes staat moeten allebei
  // kloppen. Een `Content-Type: image/png` op een HTML-foutpagina is geen
  // uitzondering maar de normale manier waarop een 404 eruitziet.
  if (!TOEGESTAAN.has(contentType) || !looksLikeImage(resource.body)) {
    throw new LogoImportError(
      "geen-afbeelding",
      // SVG staat er bewust niet bij: dat is een document dat script kan
      // bevatten, en het komt hier van een site die we niet beheren.
      "Dit bestand is geen PNG, JPG of WebP. Upload het logo hieronder zelf.",
    );
  }

  if (resource.body.byteLength >= MAX_BYTES) {
    throw new LogoImportError("te-groot", "Dit logo is groter dan 2 MB.");
  }

  const fileName = fileNameFor(resource.url, contentType);

  try {
    const stored = await getUploadStorage().put({
      assetId: `logo_${organisationId}_${Date.now().toString(36)}`,
      fileName,
      contentType,
      data: new Uint8Array(resource.body),
    });

    log.info("logo overgenomen", { organisationId, van: resource.url, bytes: stored.sizeInBytes });

    // Via de app en niet rechtstreeks uit de opslag: zo blijft de
    // rechtencontrole staan en kan de bucket morgen ergens anders draaien.
    return { url: API_ROUTES.brandKitLogo(stored.key), fileName };
  } catch (error) {
    log.error("logo opslaan mislukt", error, { organisationId });

    throw new LogoImportError("opslag", "We konden dit logo niet bewaren. Probeer het later opnieuw.");
  }
}

/**
 * Kijkt naar de eerste bytes in plaats van naar wat de server beweert.
 *
 * Een `Content-Type` is een bewering; deze handtekeningen staan in het bestand
 * zelf. Zonder deze controle is "haal mijn logo op" een manier om willekeurige
 * inhoud in onze opslag te krijgen.
 */
export function looksLikeImage(bytes: Buffer): boolean {
  if (bytes.byteLength < 12) return false;

  // PNG: \x89PNG\r\n\x1a\n
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return true;
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;

  // WebP en AVIF zitten allebei in een container met hun naam op een vaste plek.
  const kop = bytes.subarray(0, 12).toString("latin1");
  if (kop.startsWith("RIFF") && kop.slice(8, 12) === "WEBP") return true;
  if (kop.slice(4, 8) === "ftyp" && /avif|avis/.test(kop.slice(8, 12))) return true;

  return false;
}

/** Een nette naam voor in het huisstijlscherm. */
function fileNameFor(url: string, contentType: string): string {
  const extensie = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";

  try {
    const naam = new URL(url).pathname.split("/").pop()?.split(".")[0];
    if (naam) return `${naam.slice(0, 60)}.${extensie}`;
  } catch {
    // Geen bruikbare naam in het adres; dan verzinnen we er een.
  }

  return `logo.${extensie}`;
}
