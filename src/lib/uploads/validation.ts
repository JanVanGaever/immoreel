import { formatBytes } from "@/lib/format";
import type { UploadRejection } from "@/types";

/**
 * Wat er geüpload mag worden. Deze regels draaien op de client (meteen
 * feedback bij het kiezen) én horen op de server herhaald te worden: wat de
 * browser zegt over een bestand is niet te vertrouwen.
 */

export type UploadConstraints = {
  acceptedMimeTypes: readonly string[];
  /** Zonder punt. Vangnet voor bestanden die geen mimetype meekrijgen (HEIC). */
  acceptedExtensions: readonly string[];
  maxBytes: number;
  /** Hoeveel bestanden er samen in één lijst mogen. */
  maxFiles: number;
  /** Voor de foutmelding: "JPG, PNG, WebP of HEIC". */
  label: string;
};

/** Alleen de velden van `File` waar de validatie naar kijkt. */
export type FileLike = { name: string; type: string; size: number };

/** Vastgoedfoto's: wat de renderpijplijn aankan. HEIC omdat iPhones daarmee schieten. */
export const PHOTO_UPLOAD_CONSTRAINTS: UploadConstraints = {
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif"],
  acceptedExtensions: ["jpg", "jpeg", "png", "webp", "avif", "heic", "heif"],
  maxBytes: 25 * 1024 * 1024,
  maxFiles: 40,
  label: "JPG, PNG, WebP of HEIC",
};

/**
 * Van extensie naar het mimetype dat wij bewaren.
 *
 * Dit is de enige tabel die bepaalt wat er in `mimeType` van een asset
 * terechtkomt en wat `/api/assets/:id` er als `Content-Type` weer uitstuurt.
 * Wat de browser beweert, is een suggestie: bij een upload van een `.jpg` met
 * `Content-Type: text/html` erbij, is die kop precies het probleem.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * Schrijfwijzen die hetzelfde bedoelen. `image/jpg` bestaat niet volgens de
 * standaard maar wordt door genoeg toestellen verstuurd om er geen echte foto
 * op te weigeren.
 */
const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
};

/** `image/JPEG; charset=binary` → `image/jpeg`. */
export function normaliseMimeType(value: string): string {
  const bare = value.split(";")[0]?.trim().toLowerCase() ?? "";

  return MIME_ALIASES[bare] ?? bare;
}

/** Zegt de browser niets bruikbaars? Dan mag de extensie het zeggen. */
function isGenericMimeType(value: string): boolean {
  return value === "" || value === "application/octet-stream";
}

export function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Het mimetype dat we van dit bestand bewaren, of `null` als het er geen van
 * ons is.
 *
 * Nooit de waarde van de client zelf: die wordt eerst tegen de lijst gelegd en
 * dan vervangen door onze eigen schrijfwijze. Zo kan er niets in de rij belanden
 * wat een browser later als HTML of script zou uitvoeren, hoe de upload er ook
 * uitzag.
 */
export function canonicalMimeType(
  file: FileLike,
  constraints: UploadConstraints = PHOTO_UPLOAD_CONSTRAINTS,
): string | null {
  const declared = normaliseMimeType(file.type);

  if (constraints.acceptedMimeTypes.includes(declared)) return declared;

  // Alleen wanneer de browser niets zegt, valt de extensie in. Dat is het
  // HEIC-geval waarvoor die uitwijk bestaat — niet een vrijbrief om een
  // uitdrukkelijk `text/html` binnen te laten omdat het bestand `.jpg` heet.
  if (!isGenericMimeType(declared)) return null;

  const fromExtension = MIME_BY_EXTENSION[extensionOf(file.name)];

  return fromExtension && constraints.acceptedMimeTypes.includes(fromExtension)
    ? fromExtension
    : null;
}

/** De `accept`-waarde voor een `<input type="file">`, mimetypes én extensies. */
export function acceptAttribute(constraints: UploadConstraints = PHOTO_UPLOAD_CONSTRAINTS): string {
  return [
    ...constraints.acceptedMimeTypes,
    ...constraints.acceptedExtensions.map((extension) => `.${extension}`),
  ].join(",");
}

/**
 * Waarom een bestand geweigerd wordt, met de foutcode erbij.
 *
 * De code komt uit dezelfde catalogus als de rest van de app
 * (`src/lib/errors`), zodat een bestand dat híer te groot is en een bestand dat
 * de server te groot vindt, dezelfde `too-large` opleveren — en dus dezelfde
 * behandeling krijgen in het scherm.
 */
export function rejectionFor(
  file: FileLike,
  constraints: UploadConstraints = PHOTO_UPLOAD_CONSTRAINTS,
): UploadRejection | undefined {
  // Eén vraag in plaats van twee: is hier een mimetype van ons van te maken?
  //
  // Hiervóór stond er "mimetype **of** extensie", en die `of` was het gat: een
  // bestand met `Content-Type: text/html` kwam erdoor zolang het maar `.jpg`
  // heette, werd zo bewaard, en kwam er bij `/api/assets/:id` weer uit als HTML
  // op ons eigen domein. `canonicalMimeType()` laat de extensie alleen nog het
  // laatste woord wanneer de browser zelf niets zegt.
  if (canonicalMimeType(file, constraints) === null) {
    return {
      fileName: file.name,
      code: "unsupported-media",
      reason: `Geen ondersteund formaat (${constraints.label}).`,
    };
  }

  if (file.size <= 0) {
    return { fileName: file.name, code: "upload-rejected", reason: "Dit bestand is leeg." };
  }

  if (file.size > constraints.maxBytes) {
    return {
      fileName: file.name,
      code: "too-large",
      reason: `Groter dan ${formatBytes(constraints.maxBytes)}.`,
    };
  }

  return undefined;
}

/** Alleen de reden, voor wie de code niet nodig heeft. */
export function rejectionReason(
  file: FileLike,
  constraints: UploadConstraints = PHOTO_UPLOAD_CONSTRAINTS,
): string | undefined {
  return rejectionFor(file, constraints)?.reason;
}

export type FilePartition = {
  accepted: File[];
  rejected: UploadRejection[];
};

/**
 * Splitst een selectie in wat erbij mag en wat niet. `room` is hoeveel plekken
 * er nog vrij zijn; wat daar niet meer in past wordt ook geweigerd, met een
 * eigen reden — anders verdwijnen die bestanden zonder uitleg.
 */
export function partitionFiles(
  files: File[],
  constraints: UploadConstraints = PHOTO_UPLOAD_CONSTRAINTS,
  room: number = constraints.maxFiles,
): FilePartition {
  const accepted: File[] = [];
  const rejected: UploadRejection[] = [];

  for (const file of files) {
    const rejection = rejectionFor(file, constraints);

    if (rejection) {
      rejected.push(rejection);
    } else if (accepted.length >= Math.max(room, 0)) {
      rejected.push({
        fileName: file.name,
        code: "upload-rejected",
        reason: `Meer dan ${constraints.maxFiles} bestanden.`,
      });
    } else {
      accepted.push(file);
    }
  }

  return { accepted, rejected };
}
