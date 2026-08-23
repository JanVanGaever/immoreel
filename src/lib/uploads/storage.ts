import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { unavailable } from "@/lib/api/errors";
import { createLogger } from "@/lib/errors/logger";
import { openRenderOutput, RenderOutputError, type RenderOutput } from "@/lib/exports/delivery";
import { isStorageConfigured } from "@/lib/storage/config";
import { createS3Client, StorageError } from "@/lib/storage/s3";
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
/**
 * Foto's in een S3-compatibele bucket.
 *
 * De sleutel blijft dezelfde als lokaal — `ast_ab12cd34ef56.jpg` — met een map
 * ervoor. Dat is geen opsmuk: de renderworker zoekt straks op precies die naam
 * (zie `createS3AssetSource()` in `src/workers/render/assets.ts`), en één
 * afspraak over hoe een foto heet is de reden dat die twee elkaar vinden.
 *
 * De bucket hoort **privé** te staan. Niets in deze app heeft een publiek
 * object nodig: elke download loopt via de app, zodat de rechtencontrole blijft
 * staan en het bestand naar het pand heet in plaats van naar een sleutel (zie
 * `src/lib/exports/delivery.ts`).
 */
export function createS3UploadStorage(): UploadStorage {
  const client = createS3Client();

  return {
    name: "s3",

    async put({ assetId, fileName, contentType, data }) {
      // De sleutel die we bewaren is dezelfde als bij de map op schijf:
      // `ast_ab12cd34ef56.jpg`, zonder map ervoor. Die map hoort bij de bucket
      // en niet bij de asset — zo blijft een rij die vandaag naar de schijf
      // wijst morgen naar de bucket wijzen zonder dat er iets in de databank
      // hoeft te veranderen, en zo kan `open()` de sleutel nog controleren.
      const key = `${assetId}${extensionFor(contentType, fileName)}`;

      try {
        const stored = await client.put({ key: uploadKey(key), body: data, contentType });

        return { key, sizeInBytes: stored.sizeInBytes };
      } catch (error) {
        log.error("wegschrijven naar de bucket mislukt", error, { key });

        throw unavailable("De opslag nam het bestand niet aan. Probeer het straks opnieuw.");
      }
    },

    async open(key, contentType) {
      if (!KEY_PATTERN.test(key)) {
        throw unavailable("Deze opslaglocatie is onleesbaar.");
      }

      try {
        const object = await client.get(uploadKey(key));

        return {
          stream: object.stream,
          sizeInBytes: object.sizeInBytes,
          // Wat wij van de asset weten wint van wat de bucket erover zegt: die
          // waarde is bij het uploaden al tegen de lijst gelegd (zie
          // `canonicalMimeType`), en de bucket heeft die controle niet gedaan.
          contentType,
        };
      } catch (error) {
        if (error instanceof StorageError && error.isMissing) {
          throw new RenderOutputError("missing", "Het bestand staat niet meer in de opslag.", {
            cause: error,
          });
        }

        throw error;
      }
    },
  };
}

/**
 * Waar de foto's in de bucket staan. Een vaste map ervoor, zodat renders en
 * uploads in dezelfde bucket kunnen zonder elkaars sleutels te raken.
 */
export function uploadKey(key: string): string {
  return `${process.env.STORAGE_UPLOAD_PREFIX || "uploads"}/${key}`;
}

export function getUploadStorage(): UploadStorage {
  return isStorageConfigured() ? createS3UploadStorage() : createLocalUploadStorage();
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
