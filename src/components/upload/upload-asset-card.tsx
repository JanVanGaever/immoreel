"use client";

import type { DragEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImageIcon,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ID, UploadAsset, UploadStatus } from "@/types";

const statusLabels: Record<UploadStatus, string> = {
  queued: "In wachtrij",
  uploading: "Uploaden",
  done: "Klaar",
  error: "Mislukt",
  canceled: "Geannuleerd",
};

export type UploadAssetCardProps = {
  asset: UploadAsset;
  index: number;
  total: number;
  /** Toont de eerste foto als cover van de video. */
  showCover?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onRemove: (assetId: ID) => void;
  onCancel: (assetId: ID) => void;
  onRetry: (assetId: ID) => void;
  onMove: (assetId: ID, offset: number) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>, index: number) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>, index: number) => void;
  onDrop: (event: DragEvent<HTMLLIElement>, index: number) => void;
  onDragEnd: () => void;
};

/**
 * Eén foto in de lijst: voorbeeld, plaats in de volgorde, voortgang en wat je
 * ermee kan doen. Verslepen werkt met de muis; de pijlknoppen doen hetzelfde
 * met toetsenbord en op een touchscreen, waar HTML5-slepen niet bestaat.
 */
export function UploadAssetCard({
  asset,
  index,
  total,
  showCover = true,
  isDragging = false,
  isDropTarget = false,
  onRemove,
  onCancel,
  onRetry,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: UploadAssetCardProps) {
  const isBusy = asset.status === "uploading" || asset.status === "queued";
  const hasFailed = asset.status === "error" || asset.status === "canceled";

  /**
   * De knop verschijnt alleen als opnieuw proberen ook iets kan opleveren. Een
   * bestand dat te groot is, blijft te groot: daar is "Opnieuw proberen" een
   * belofte die de knop niet waarmaakt, en dan is verwijderen het echte antwoord.
   */
  const mayRetry = asset.status === "canceled" || (asset.error?.retry.mode ?? "manual") !== "none";

  return (
    <li
      draggable
      onDragStart={(event) => onDragStart(event, index)}
      onDragOver={(event) => onDragOver(event, index)}
      onDrop={(event) => onDrop(event, index)}
      onDragEnd={onDragEnd}
      aria-label={`${index + 1}. ${asset.fileName}`}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-surface-subtle",
        "transition-[border-color,opacity,transform] duration-150",
        hasFailed ? "border-danger/40" : "border-border",
        isDragging && "opacity-40",
        isDropTarget && "border-brand ring-2 ring-brand/40",
      )}
    >
      {/* Alles wat over de foto ligt, hoort binnen dit vlak: de knoppen mogen
          de bestandsnaam eronder niet afdekken op een smal scherm. */}
      <div className="relative">
        <span className="flex aspect-[4/3] items-center justify-center">
          {asset.previewUrl ? (
            // Blob-URL uit de browser van de gebruiker: die kan next/image niet
            // optimaliseren, en er valt hier ook niets te optimaliseren.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.previewUrl}
              alt={asset.fileName}
              draggable={false}
              className={cn(
                "size-full object-cover transition-opacity duration-200",
                isBusy && "opacity-70",
              )}
            />
          ) : (
            <ImageIcon aria-hidden="true" className="size-5 text-fg-subtle" />
          )}
        </span>

        <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-fg/75 px-2 py-0.5 text-[0.6875rem] font-semibold text-fg-inverted">
          <GripVertical aria-hidden="true" className="size-3 cursor-grab" />
          {index + 1}
          {showCover && index === 0 ? <span className="font-medium">· cover</span> : null}
        </span>

        {asset.status !== "done" ? (
          <span className="absolute top-2 right-2">
            <Badge size="sm" variant={hasFailed ? "danger" : "neutral"} dot>
              {statusLabels[asset.status]}
            </Badge>
          </span>
        ) : null}

        {/* Op een touchscreen bestaat hoveren niet; daar staan de knoppen vast. */}
        <span className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
          <IconButton
            label={`${asset.fileName} naar voren`}
            variant="secondary"
            size="icon-sm"
            onClick={() => onMove(asset.id, -1)}
            disabled={index === 0}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            label={`${asset.fileName} naar achteren`}
            variant="secondary"
            size="icon-sm"
            onClick={() => onMove(asset.id, 1)}
            disabled={index === total - 1}
          >
            <ChevronRight />
          </IconButton>
          {hasFailed && mayRetry ? (
            <IconButton
              label={`${asset.fileName} opnieuw proberen`}
              variant="secondary"
              size="icon-sm"
              onClick={() => onRetry(asset.id)}
            >
              <RotateCcw />
            </IconButton>
          ) : null}
          {asset.status === "uploading" ? (
            <IconButton
              label={`Upload van ${asset.fileName} stoppen`}
              variant="secondary"
              size="icon-sm"
              onClick={() => onCancel(asset.id)}
            >
              <X />
            </IconButton>
          ) : (
            <IconButton
              label={`${asset.fileName} verwijderen`}
              variant="secondary"
              size="icon-sm"
              onClick={() => onRemove(asset.id)}
            >
              <Trash2 />
            </IconButton>
          )}
        </span>
      </div>

      <div className="border-t border-border bg-surface px-2.5 py-2">
        <p className="truncate text-xs font-medium text-fg" title={asset.fileName}>
          {asset.fileName}
        </p>

        {asset.status === "error" ? (
          <p className="mt-0.5 text-xs text-danger" title={asset.error?.errorId ?? undefined}>
            {asset.error?.message ?? "De upload is mislukt."}
          </p>
        ) : isBusy ? (
          <Meter
            className="mt-1.5"
            size="sm"
            value={asset.progress}
            max={100}
            srLabel={`Upload van ${asset.fileName}`}
            label={
              <span className="text-xs">
                {/* Zolang de hook het zelf opnieuw probeert, hoort dat er te
                    staan: een balk die terugspringt zonder uitleg leest als een
                    upload die vastloopt. */}
                {asset.attempts ? `Poging ${asset.attempts + 1}` : formatBytes(asset.sizeInBytes)}
              </span>
            }
            valueLabel={<span className="text-xs">{Math.round(asset.progress)}%</span>}
          />
        ) : (
          <p className="mt-0.5 text-xs text-fg-muted">
            {formatBytes(asset.sizeInBytes)}
            {asset.status === "canceled" ? " · gestopt" : null}
          </p>
        )}
      </div>
    </li>
  );
}
