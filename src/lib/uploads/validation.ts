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
  const byMimeType = constraints.acceptedMimeTypes.includes(file.type);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExtension = constraints.acceptedExtensions.includes(extension);

  if (!byMimeType && !byExtension) {
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
