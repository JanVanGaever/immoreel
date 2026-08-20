import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { unavailable } from "@/lib/api/errors";
import { createLogger } from "@/lib/errors/logger";
import { openRenderOutput, type RenderOutput } from "@/lib/exports/delivery";
import { assetSourceDir, workDir } from "@/workers/config";
import type { ID } from "@/types";

const log = createLogger("uploads");

/**
 * Waar een geüploade foto heen gaat.
 *
 * De serverkant van `src/lib/uploads/transport.ts`: die brengt het bestand van
 * de browser naar de route, dit brengt het van de route naar de opslag. Zelfde
 * poortgedachte als bij de renders (`src/workers/render/storage.ts`), en om
 * dezelfde reden: de dag dat er een bucket is, verandert er één functie en
 * geen enkele route.
 *
 * De sleutel is plat en heet naar de asset: `ast_ab12cd34ef56.jpg`. Dat is geen
 * detail maar de koppeling met de renderpijplijn — `createLocalAssetSource()`
 * zoekt een bestand met de naam van de asset in `RENDER_ASSET_DIR`, en
 * `createHttpAssetSource()` haalt `${basis}/${assetId}` op. Staat `UPLOAD_DIR`
 * niet ingesteld, dan schrijven we daarom rechtstreeks in `RENDER_ASSET_DIR`:
 * wat de makelaar uploadt, is dan meteen wat de worker rendert.
 */

export type StoredUpload = {
  key: string;
  sizeInBytes: number;
};

export type UploadStorage = {
  readonly name: string;
  put(input: {
    assetId: ID;
    fileName: string;
    contentType: string;
    data: Uint8Array;
  }): Promise<StoredUpload>;
  /** De bytes weer opdiepen, voor `/api/assets/:assetId`. */
  open(key: string, contentType: string): Promise<RenderOutput>;
};

/** Waar de foto's staan zolang er geen object storage is. */
export function uploadDir(): string {
  return process.env.UPLOAD_DIR || assetSourceDir() || join(workDir(), "uploads");
}

/**
 * Een sleutel die we zelf gemaakt hebben, ziet er zo uit. De controle staat er
 * niet omdat we onszelf wantrouwen, maar omdat de sleutel uit een rij in de
 * store komt en een pad wordt: één plek waar dat kan misgaan is één plek te
 * veel.
 */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function createLocalUploadStorage(): UploadStorage {
  const root = resolve(uploadDir());

  return {
    name: "local",

    async put({ assetId, fileName, contentType, data }) {
      const key = `${assetId}${extensionFor(contentType, fileName)}`;
      const destination = join(root, key);

      try {
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, data);

        const info = await stat(destination);

        return { key, sizeInBytes: info.size };
      } catch (error) {
        log.error("wegschrijven mislukt", error, { root, key });

        throw unavailable("De opslag nam het bestand niet aan. Probeer het straks opnieuw.");
      }
    },

    async open(key, contentType) {
      if (!KEY_PATTERN.test(key)) {
        throw unavailable("Deze opslaglocatie is onleesbaar.");
      }

      return openRenderOutput(pathToFileURL(join(root, key)).href, contentType);
    },
  };
}

/**
 * De echte opslag: het bucket uit `STORAGE_BUCKET`. Zolang die er niet is,
 * blijft het bij de map op schijf — met een duidelijke 503 in plaats van
 * bestanden die stilletjes ergens anders belanden dan de worker kijkt.
 */
export function getUploadStorage(): UploadStorage {
  if (!process.env.STORAGE_BUCKET) return createLocalUploadStorage();

  // TODO: S3-compatibele implementatie met de sleutels uit .env.example.
  throw unavailable(
    "Object storage is nog niet aangesloten; verwijder STORAGE_BUCKET om lokaal te schrijven.",
  );
}

/**
 * De extensie die bij dit bestand hoort.
 *
 * Het mimetype gaat voor, want dat is wat de browser over de inhoud zegt. Bij
 * HEIC-foto's van een iPhone ontbreekt dat soms; dan valt hij terug op de naam,
 * precies zoals `rejectionReason()` dat doet.
 */
export function extensionFor(contentType: string, fileName: string): string {
  switch (contentType.split(";")[0]?.trim().toLowerCase()) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/avif":
      return ".avif";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    default:
      break;
  }

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  return /^[a-z0-9]{2,5}$/.test(extension) ? `.${extension}` : ".jpg";
}
