"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createLogger } from "@/lib/errors/logger";
import { isAbortError, toAppError } from "@/lib/errors/normalize";
import { withRetry } from "@/lib/errors/retry";
import type { UploadTransport } from "@/lib/uploads/transport";
import {
  PHOTO_UPLOAD_CONSTRAINTS,
  partitionFiles,
  type UploadConstraints,
} from "@/lib/uploads/validation";
import type { ID, UploadAsset, UploadRejection } from "@/types";

/**
 * De staat van een uploadlijst: valideren, uploaden, opnieuw proberen,
 * verwijderen en sorteren. De componenten eromheen gaan daardoor alleen nog
 * over hoe het eruitziet.
 *
 * De volgorde van `assets` ís de volgorde van de foto's. Er wordt geen
 * `position` bijgehouden, want twee bronnen van waarheid lopen vroeg of laat
 * uit elkaar — bij het bewaren maak je er met `toUploadOrder()` posities van.
 *
 * **Mislukken gaat in twee stappen.** Een fout waarvan de catalogus zegt dat
 * hij vanzelf overgaat — een verbinding die hapert, opslag die even niet
 * antwoordt — probeert deze hook zelf opnieuw, met oplopende tussenpozen. De
 * foto blijft dan gewoon "uploaden" en de teller loopt: dat is eerlijker dan
 * een rood kruis dat een seconde later toch weer groen wordt. Pas als ook dat
 * niet lukt, of als de fout er een is die zich niet laat overrulen (een bestand
 * dat te groot is blijft te groot), komt de melding in beeld — met de knop
 * ernaast als de gebruiker het alsnog mag proberen.
 */

const log = createLogger("upload");

export type UseUploadsOptions = {
  /** Waar de bestanden heen gaan. Zie `@/lib/uploads/transport`. */
  transport: UploadTransport;
  constraints?: UploadConstraints;
  /** Assets die al op de server staan; die beginnen als afgerond. */
  initialAssets?: UploadAsset[];
  /** Hoeveel bestanden er tegelijk de deur uit gaan. */
  concurrency?: number;
  /** Loopt bij elke wijziging van de lijst, ook bij voortgang. */
  onChange?: (assets: UploadAsset[]) => void;
};

export type UploadStats = {
  total: number;
  done: number;
  failed: number;
  pending: number;
  /** Gewogen op bestandsgrootte: één grote foto trekt de balk niet meteen vol. */
  progress: number;
  isUploading: boolean;
  /** Alles binnen én minstens één asset. */
  isComplete: boolean;
};

export type UploadsController = {
  assets: UploadAsset[];
  rejections: UploadRejection[];
  stats: UploadStats;
  constraints: UploadConstraints;
  /** Hoeveel bestanden er nog bij mogen. */
  room: number;
  add(files: File[]): void;
  remove(assetId: ID): void;
  cancel(assetId: ID): void;
  retry(assetId: ID): void;
  /** Eén plek naar voren (-1) of naar achteren (1). */
  move(assetId: ID, offset: number): void;
  reorder(fromIndex: number, toIndex: number): void;
  clearRejections(): void;
};

function createUploadId(): ID {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2);

  return `upl_${random.slice(0, 12)}`;
}

function toAsset(file: File): UploadAsset {
  return {
    id: createUploadId(),
    fileName: file.name,
    mimeType: file.type,
    sizeInBytes: file.size,
    previewUrl: URL.createObjectURL(file),
    status: "queued",
    progress: 0,
  };
}

export function useUploads({
  transport,
  constraints = PHOTO_UPLOAD_CONSTRAINTS,
  initialAssets = [],
  concurrency = 3,
  onChange,
}: UseUploadsOptions): UploadsController {
  const [assets, setAssets] = useState<UploadAsset[]>(initialAssets);
  const [rejections, setRejections] = useState<UploadRejection[]>([]);

  /**
   * De lijst staat ook in een ref, zodat `add` en `move` de actuele stand
   * kennen zonder dat elke callback bij elke render een nieuwe identiteit krijgt.
   */
  const assetsRef = useRef<UploadAsset[]>(assets);
  /** De bestanden zelf horen niet in de state: ze zijn groot en niet vergelijkbaar. */
  const filesRef = useRef(new Map<ID, File>());
  const controllersRef = useRef(new Map<ID, AbortController>());
  const startedRef = useRef(new Set<ID>());
  const previewUrlsRef = useRef(new Set<string>());

  // De laatste versie van wat de gebruiker meegeeft, zonder de uploadlus
  // opnieuw op te starten wanneer er een nieuwe functie doorkomt.
  const transportRef = useRef(transport);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    transportRef.current = transport;
    onChangeRef.current = onChange;
  });

  const commit = useCallback((update: (current: UploadAsset[]) => UploadAsset[]) => {
    const next = update(assetsRef.current);

    assetsRef.current = next;
    setAssets(next);
  }, []);

  const patch = useCallback(
    (assetId: ID, changes: Partial<UploadAsset>) => {
      commit((current) =>
        current.map((asset) => (asset.id === assetId ? { ...asset, ...changes } : asset)),
      );
    },
    [commit],
  );

  const releasePreview = useCallback((asset: UploadAsset | undefined) => {
    // Alleen blob-URLs zijn van ons; een URL uit de opslag blijft geldig.
    if (!asset?.previewUrl || !previewUrlsRef.current.has(asset.previewUrl)) return;

    URL.revokeObjectURL(asset.previewUrl);
    previewUrlsRef.current.delete(asset.previewUrl);
  }, []);

  const startUpload = useCallback(
    async (asset: UploadAsset) => {
      const file = filesRef.current.get(asset.id);
      if (!file) return;

      const controller = new AbortController();

      startedRef.current.add(asset.id);
      controllersRef.current.set(asset.id, controller);
      patch(asset.id, { status: "uploading", progress: 0, attempts: 0, error: undefined });

      try {
        // `withRetry` voert het beleid uit dat bij de fout hoort; wat níet
        // vanzelf overgaat, komt er meteen weer uit.
        const result = await withRetry(
          () =>
            transportRef.current({
              file,
              assetId: asset.id,
              signal: controller.signal,
              onProgress: (percentage) => {
                patch(asset.id, { progress: Math.min(Math.max(percentage, 0), 100) });
              },
            }),
          {
            signal: controller.signal,
            onRetry: (error, attempt, delayMs) => {
              log.warn("upload wordt opnieuw geprobeerd", {
                fileName: asset.fileName,
                errorCode: error.code,
                attempt,
                delayMs,
              });

              patch(asset.id, { progress: 0, attempts: attempt - 1 });
            },
          },
        );

        filesRef.current.delete(asset.id);
        patch(asset.id, {
          status: "done",
          progress: 100,
          error: undefined,
          remoteId: result.remoteId ?? null,
          url: result.url ?? null,
        });
      } catch (cause) {
        if (isAbortError(cause)) {
          patch(asset.id, { status: "canceled", progress: 0, error: undefined });
        } else {
          const failure = toAppError(cause, {
            fallback: "upload-failed",
            context: { fileName: asset.fileName, sizeInBytes: asset.sizeInBytes },
          });

          log.error("upload definitief mislukt", failure, { fileName: asset.fileName });
          patch(asset.id, { status: "error", error: failure.toShape() });
        }
      } finally {
        controllersRef.current.delete(asset.id);
        startedRef.current.delete(asset.id);
      }
    },
    [patch],
  );

  // De uploadlus: zolang er plaats is, gaat het volgende bestand de deur uit.
  useEffect(() => {
    const active = assets.filter((asset) => asset.status === "uploading").length;
    const room = Math.max(concurrency - active, 0);
    if (room === 0) return;

    assets
      .filter((asset) => asset.status === "queued" && !startedRef.current.has(asset.id))
      .slice(0, room)
      .forEach((asset) => void startUpload(asset));
  }, [assets, concurrency, startUpload]);

  useEffect(() => {
    onChangeRef.current?.(assets);
  }, [assets]);

  // Bij het verlaten van het scherm: lopende uploads afbreken en de blob-URLs
  // vrijgeven, anders blijven de bestanden in het geheugen hangen.
  useEffect(() => {
    const controllers = controllersRef.current;
    const previewUrls = previewUrlsRef.current;

    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, []);

  const add = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const room = Math.max(constraints.maxFiles - assetsRef.current.length, 0);
      const { accepted, rejected } = partitionFiles(files, constraints, room);

      setRejections(rejected);
      if (accepted.length === 0) return;

      const newAssets = accepted.map((file) => {
        const asset = toAsset(file);

        filesRef.current.set(asset.id, file);
        if (asset.previewUrl) previewUrlsRef.current.add(asset.previewUrl);

        return asset;
      });

      // Achteraan: nieuwe foto's mogen de volgorde die er al ligt niet omgooien.
      commit((current) => [...current, ...newAssets]);
    },
    [commit, constraints],
  );

  const remove = useCallback(
    (assetId: ID) => {
      controllersRef.current.get(assetId)?.abort();
      filesRef.current.delete(assetId);
      releasePreview(assetsRef.current.find((asset) => asset.id === assetId));

      commit((current) => current.filter((asset) => asset.id !== assetId));
    },
    [commit, releasePreview],
  );

  const cancel = useCallback((assetId: ID) => {
    controllersRef.current.get(assetId)?.abort();
  }, []);

  const retry = useCallback(
    (assetId: ID) => {
      // Zonder het bestand valt er niets opnieuw te proberen; dat is het geval
      // bij een asset die al op de server staat.
      if (!filesRef.current.has(assetId)) return;

      // De teller gaat terug naar nul: dit is een nieuwe opdracht van de
      // gebruiker, geen vervolg op de pogingen die de hook zelf al deed.
      patch(assetId, { status: "queued", progress: 0, attempts: 0, error: undefined });
    },
    [patch],
  );

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      commit((current) => {
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= current.length ||
          toIndex >= current.length
        ) {
          return current;
        }

        const next = [...current];
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) return current;

        next.splice(toIndex, 0, moved);

        return next;
      });
    },
    [commit],
  );

  const move = useCallback(
    (assetId: ID, offset: number) => {
      const index = assetsRef.current.findIndex((asset) => asset.id === assetId);
      if (index < 0) return;

      reorder(index, index + offset);
    },
    [reorder],
  );

  const clearRejections = useCallback(() => setRejections([]), []);

  return {
    assets,
    rejections,
    stats: statsFor(assets),
    constraints,
    room: Math.max(constraints.maxFiles - assets.length, 0),
    add,
    remove,
    cancel,
    retry,
    move,
    reorder,
    clearRejections,
  };
}

function statsFor(assets: UploadAsset[]): UploadStats {
  const done = assets.filter((asset) => asset.status === "done").length;
  const failed = assets.filter((asset) => asset.status === "error").length;
  const isUploading = assets.some(
    (asset) => asset.status === "uploading" || asset.status === "queued",
  );

  // Een lege selectie of een leeg bestand mag de deling niet laten ontsporen.
  const totalBytes = assets.reduce((sum, asset) => sum + Math.max(asset.sizeInBytes, 1), 0);
  const uploadedBytes = assets.reduce(
    (sum, asset) => sum + (Math.max(asset.sizeInBytes, 1) * asset.progress) / 100,
    0,
  );

  return {
    total: assets.length,
    done,
    failed,
    pending: assets.length - done - failed,
    progress: assets.length === 0 ? 0 : (uploadedBytes / totalBytes) * 100,
    isUploading,
    isComplete: assets.length > 0 && done === assets.length,
  };
}
