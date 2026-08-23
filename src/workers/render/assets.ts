import { copyFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { Readable } from "node:stream";
import { getProjectAssetStore } from "@/db/project-asset-store";
import { RenderError } from "@/lib/render/errors";
import { isStorageConfigured } from "@/lib/storage/config";
import { createS3Client, StorageError } from "@/lib/storage/s3";
import { uploadKey } from "@/lib/uploads/storage";
import { assetBaseUrl, assetSourceDir } from "@/workers/config";
import type { ID } from "@/types";

/**
 * Waar de foto's vandaan komen.
 *
 * De tegenhanger van `src/workers/render/storage.ts`: die schrijft het
 * resultaat weg, deze haalt het materiaal op. Ze staan los van elkaar omdat ze
 * op verschillende momenten echt worden — een render kan uit een map op schijf
 * lezen terwijl het resultaat al naar een bucket gaat, en omgekeerd.
 *
 * FFmpeg leest liever van schijf dan van een URL: bij een haperende verbinding
 * halverwege een render is een mislukte download een fout die het opnieuw
 * proberen waard is, terwijl een afgebroken encodering dat niet is. Vandaar dat
 * elke foto eerst binnengehaald wordt en pas daarna gerenderd.
 */

export type FetchAssetInput = {
  assetId: ID;
  /**
   * Het kantoor waar deze foto bij hoort. De bron die uit object storage leest,
   * zoekt de rij op om aan de opslagsleutel te komen, en een asset opzoeken
   * gebeurt in deze app nooit zonder organisatie erbij.
   */
  organisationId: ID;
  /** Pad zonder extensie; de bron kiest de extensie van het bestand zelf. */
  destination: string;
  signal: AbortSignal;
};

export type RenderAssetSource = {
  readonly name: string;
  /** Zet de foto in de werkmap en geeft het volledige pad terug. */
  fetch(input: FetchAssetInput): Promise<string>;
};

/** Wat we als foto accepteren. Alles daarbuiten is geen bron voor een scène. */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".tif", ".tiff"];

/**
 * Foto's uit een map op schijf, op naam van de asset. Genoeg om de hele
 * pijplijn met echte beelden te draaien zolang er geen object storage is.
 */
export function createLocalAssetSource(directory: string): RenderAssetSource {
  return {
    name: "local",

    async fetch({ assetId, destination }) {
      const entries = await readdir(directory).catch(() => {
        throw new RenderError("asset-download", {
          stage: "fetch",
          detail: `De map met foto's is niet leesbaar: ${directory}`,
        });
      });

      const match = entries.find(
        (entry) =>
          basename(entry, extname(entry)) === assetId &&
          IMAGE_EXTENSIONS.includes(extname(entry).toLowerCase()),
      );

      if (!match) {
        // Een bestand dat er niet staat, staat er bij poging drie ook niet.
        throw new RenderError("assets-missing", {
          stage: "fetch",
          detail: `Geen foto voor asset ${assetId} in ${directory}.`,
        });
      }

      const target = `${destination}${extname(match).toLowerCase()}`;
      await copyFile(join(directory, match), target);

      return target;
    },
  };
}

/**
 * Foto's over HTTP, van `${basis}/${assetId}`. Dit is de vorm die straks naar
 * de object storage wijst; alleen de basis-URL verandert dan.
 */
export function createHttpAssetSource(baseUrl: string): RenderAssetSource {
  return {
    name: "http",

    async fetch({ assetId, destination, signal }) {
      const url = `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(assetId)}`;

      const response = await fetch(url, { signal }).catch((error: unknown) => {
        throw new RenderError("asset-download", { stage: "fetch", detail: url, cause: error });
      });

      if (!response.ok) {
        throw new RenderError("asset-download", {
          stage: "fetch",
          detail: `${url} gaf ${response.status}.`,
        });
      }

      // De extensie volgt uit het content-type: FFmpeg raadt het formaat wel uit
      // de inhoud, maar een bestand met de juiste naam is een stuk makkelijker
      // terug te vinden in een logregel.
      const target = `${destination}${extensionForType(response.headers.get("content-type"))}`;
      await writeFile(target, Buffer.from(await response.arrayBuffer()));

      return target;
    },
  };
}

/**
 * Welke bron er draait. Een map op schijf wint van een URL: staat ze ingesteld,
 * dan is dat een bewuste keuze van wie de worker start.
 */
/**
 * Foto's uit de S3-compatibele bucket waar de uploads in staan.
 *
 * De sleutel wordt niet geraden maar opgezocht: `project_assets` weet welke
 * `storageKey` bij deze asset hoort. Dat scheelt een zoekopdracht in de bucket
 * per foto, en het is de enige manier om zeker te weten dat de render dezelfde
 * bytes krijgt als wat de makelaar geüpload heeft — een bestandsnaam raden op
 * extensie is een gok die bij één iPhone-foto in de veertig misgaat.
 */
export function createS3AssetSource(): RenderAssetSource {
  const client = createS3Client();

  return {
    name: "s3",

    async fetch({ assetId, organisationId, destination }) {
      const asset = await getProjectAssetStore().findAsset(organisationId, assetId);

      if (!asset?.storageKey) {
        // Geen rij of geen sleutel: de upload is nooit afgerond. Bij poging drie
        // is dat niet anders.
        throw new RenderError("assets-missing", {
          stage: "fetch",
          detail: `Geen opslagsleutel voor asset ${assetId}.`,
        });
      }

      const key = uploadKey(asset.storageKey);
      const target = `${destination}${extname(asset.storageKey).toLowerCase() || ".jpg"}`;

      try {
        const object = await client.get(key);

        // Naar schijf en niet naar het geheugen: FFmpeg leest liever van schijf,
        // en veertig foto's in het geheugen naast een lopende render is vragen om
        // problemen.
        await writeFile(target, Readable.fromWeb(object.stream as never));

        return target;
      } catch (error) {
        if (error instanceof StorageError && error.isMissing) {
          throw new RenderError("assets-missing", {
            stage: "fetch",
            detail: `${key} staat niet in de opslag.`,
            cause: error,
          });
        }

        throw new RenderError("asset-download", { stage: "fetch", detail: key, cause: error });
      }
    },
  };
}

export function getRenderAssetSource(): RenderAssetSource {
  // Een map op schijf wint nog steeds: wie `RENDER_ASSET_DIR` zet, doet dat
  // bewust om met eigen bestanden te draaien.
  const directory = assetSourceDir();
  if (directory) return createLocalAssetSource(directory);

  if (isStorageConfigured()) return createS3AssetSource();

  const baseUrl = assetBaseUrl();
  if (baseUrl) return createHttpAssetSource(baseUrl);

  throw new RenderError("assets-missing", {
    stage: "fetch",
    detail: "Er is geen bron voor de foto's ingesteld (RENDER_ASSET_DIR of RENDER_ASSET_BASE_URL).",
  });
}

function extensionForType(contentType: string | null): string {
  const type = (contentType ?? "").split(";")[0]?.trim().toLowerCase();

  switch (type) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/avif":
      return ".avif";
    case "image/tiff":
      return ".tiff";
    default:
      return ".jpg";
  }
}
