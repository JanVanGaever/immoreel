import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { RenderError } from "@/lib/render/errors";
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
export function getRenderStorage(): RenderStorage {
  if (!process.env.STORAGE_BUCKET) return createLocalStorage();

  // TODO: S3-compatibele implementatie met de sleutels uit .env.example.
  throw new RenderError("storage", {
    stage: "publish",
    detail: "Object storage is nog niet aangesloten; verwijder STORAGE_BUCKET om lokaal te schrijven.",
  });
}
