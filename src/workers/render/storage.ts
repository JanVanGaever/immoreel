import { createReadStream } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { RenderError } from "@/lib/render/errors";
import { isStorageConfigured } from "@/lib/storage/config";
import { createS3Client } from "@/lib/storage/s3";
import { workDir } from "@/workers/config";

/**
 * Waar een afgewerkte render heen gaat.
 *
 * Dezelfde poortgedachte als bij de uploads (`src/lib/uploads/transport.ts`),
 * maar dan aan de serverkant. De sleutel is altijd afgeleid van de job (zie
 * `src/lib/render/fingerprint.ts`), dus een tweede poging overschrijft het
 * vorige bestand in plaats van er eentje naast te zetten. Dat is de laatste
 * schakel in de idempotentie: ook als er twee workers hetzelfde gerenderd
 * hebben, blijft er één bestand over.
 */

export type StoredRenderOutput = {
  key: string;
  url: string;
  sizeInBytes: number;
};

export type RenderStorage = {
  readonly name: string;
  put(input: { key: string; path: string; contentType: string }): Promise<StoredRenderOutput>;
};

/**
 * Schrijft naar een map op schijf. Genoeg om de pijplijn rond te maken en om
 * lokaal te kijken wat er uitkomt.
 */
export function createLocalStorage(): RenderStorage {
  const root = resolve(workDir(), "published");

  return {
    name: "local",

    async put({ key, path }) {
      const destination = join(root, key);

      try {
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(path, destination);

        const info = await stat(destination);

        return { key, url: pathToFileURL(destination).href, sizeInBytes: info.size };
      } catch (error) {
        throw new RenderError("storage", { stage: "publish", cause: error });
      }
    },
  };
}

/**
 * De echte opslag: het bucket uit `STORAGE_BUCKET`. Zolang die er niet is,
 * blijft het bij de map op schijf.
 */
/**
 * De afgewerkte video naar een S3-compatibele bucket.
 *
 * Het bestand gaat er als stroom in en niet als buffer: een render van
 * tweehonderd megabyte hoort geen tweehonderd megabyte serverheugen te kosten,
 * en de worker draait er misschien twee tegelijk.
 *
 * De sleutel komt van de job en is dus afgeleid van het renderplan. Twee
 * workers die hetzelfde gerenderd hebben, schrijven daardoor naar dezelfde
 * plek — dat is de laatste schakel van de idempotentie, en hij blijft precies
 * hetzelfde werken als bij de map op schijf.
 */
export function createS3RenderStorage(): RenderStorage {
  const client = createS3Client();

  return {
    name: "s3",

    async put({ key, path, contentType }) {
      const target = renderKey(key);

      try {
        const info = await stat(path);
        const stream = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;

        await client.put({ key: target, body: stream, contentType, sizeInBytes: info.size });

        return { key: target, url: client.urlFor(target), sizeInBytes: info.size };
      } catch (error) {
        throw new RenderError("storage", { stage: "publish", detail: target, cause: error });
      }
    },
  };
}

/** Waar de renders in de bucket staan, gescheiden van de uploads. */
export function renderKey(key: string): string {
  return `${process.env.STORAGE_RENDER_PREFIX || "renders"}/${key}`;
}

export function getRenderStorage(): RenderStorage {
  return isStorageConfigured() ? createS3RenderStorage() : createLocalStorage();
}
