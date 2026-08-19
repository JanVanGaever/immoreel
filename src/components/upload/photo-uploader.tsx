"use client";

import { useMemo } from "react";
import { Images } from "lucide-react";
import { UploadAssetList } from "@/components/upload/upload-asset-list";
import { UploadZone } from "@/components/upload/upload-zone";
import { useUploads, type UseUploadsOptions } from "@/components/upload/use-uploads";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { formatBytes } from "@/lib/format";
import { createFakeTransport } from "@/lib/uploads/transport";
import { cn } from "@/lib/utils";

export type PhotoUploaderProps = Partial<UseUploadsOptions> & {
  /** Titel van de lege staat. */
  title?: string;
  description?: string;
  /** Markeert de eerste foto als cover van de video. */
  showCover?: boolean;
  className?: string;
};

/**
 * Sleepzone en assetlijst samen, met de uploadstaat ertussen. Dit is het
 * component dat een scherm gebruikt; wie meer wil sturen (een eigen indeling,
 * een knop in een formulier) gebruikt `useUploads` met `UploadZone` en
 * `UploadAssetList` los.
 *
 * Zonder `transport` draait alles op een nagebootste upload, zodat het scherm
 * nu al werkt. Zodra de opslag er staat, geef je `createXhrTransport({ endpoint })`
 * mee en verandert er verder niets.
 */
export function PhotoUploader({
  transport,
  constraints,
  initialAssets,
  concurrency,
  onChange,
  title = "Sleep je foto's hierheen",
  description,
  showCover = true,
  className,
}: PhotoUploaderProps) {
  const fallbackTransport = useMemo(() => createFakeTransport(), []);

  const uploads = useUploads({
    transport: transport ?? fallbackTransport,
    constraints,
    initialAssets,
    concurrency,
    onChange,
  });

  const { assets, rejections, stats, room } = uploads;
  const isEmpty = assets.length === 0;
  const totalBytes = assets.reduce((sum, asset) => sum + asset.sizeInBytes, 0);
  const failedAssets = assets.filter((asset) => asset.status === "error");

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {isEmpty ? (
        // De lege staat is de sleepzone zelf: een apart leeg vlak boven een
        // uploadveld zegt twee keer hetzelfde.
        <UploadZone
          onFiles={uploads.add}
          constraints={uploads.constraints}
          icon={Images}
          title={title}
          description={description}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Meter
              className="min-w-52 flex-1"
              value={stats.isUploading ? stats.progress : assets.length}
              max={stats.isUploading ? 100 : uploads.constraints.maxFiles}
              tone={stats.failed > 0 ? "warning" : stats.isComplete ? "success" : "brand"}
              label={
                stats.isUploading
                  ? `${stats.done} van ${stats.total} geüpload`
                  : `${assets.length} ${assets.length === 1 ? "foto" : "foto's"} · ${formatBytes(totalBytes)}`
              }
              valueLabel={
                stats.isUploading
                  ? `${Math.round(stats.progress)}%`
                  : `Nog ${room} vrij`
              }
            />
          </div>

          <UploadAssetList
            assets={assets}
            onRemove={uploads.remove}
            onCancel={uploads.cancel}
            onRetry={uploads.retry}
            onMove={uploads.move}
            onReorder={uploads.reorder}
            showCover={showCover}
          />

          <UploadZone
            compact
            onFiles={uploads.add}
            constraints={uploads.constraints}
            title="Nog foto's toevoegen? Sleep ze hierheen."
            buttonLabel="Kiezen"
            disabled={room === 0}
            disabledReason={`Je zit aan het maximum van ${uploads.constraints.maxFiles} foto's.`}
          />
        </>
      )}

      {rejections.length > 0 ? (
        <Alert
          variant="warning"
          title={`${rejections.length} bestand${rejections.length === 1 ? "" : "en"} overgeslagen`}
        >
          <ul className="mt-1 space-y-0.5">
            {rejections.slice(0, 5).map((rejection) => (
              <li key={`${rejection.fileName}-${rejection.reason}`}>
                {rejection.fileName} — {rejection.reason}
              </li>
            ))}
            {rejections.length > 5 ? <li>en nog {rejections.length - 5} andere.</li> : null}
          </ul>
          <Button variant="ghost" size="sm" className="mt-2 -ml-3" onClick={uploads.clearRejections}>
            Melding sluiten
          </Button>
        </Alert>
      ) : null}

      {failedAssets.length > 0 ? (
        <Alert
          variant="danger"
          title={`${failedAssets.length} upload${failedAssets.length === 1 ? "" : "s"} mislukt`}
        >
          De foto&apos;s staan nog in de lijst, dus je volgorde blijft staan.
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 -ml-3"
            onClick={() => failedAssets.forEach((asset) => uploads.retry(asset.id))}
          >
            Alles opnieuw proberen
          </Button>
        </Alert>
      ) : null}
    </div>
  );
}
