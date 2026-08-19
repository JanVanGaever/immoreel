"use client";

import { useState, type DragEvent } from "react";
import { UploadAssetCard } from "@/components/upload/upload-asset-card";
import { cn } from "@/lib/utils";
import type { ID, UploadAsset } from "@/types";

/** Eigen sleeptype, zodat een verplaatsing niet te verwarren is met een upload. */
const REORDER_TYPE = "application/x-immoreel-asset-index";

export type UploadAssetListProps = {
  assets: UploadAsset[];
  onRemove: (assetId: ID) => void;
  onCancel: (assetId: ID) => void;
  onRetry: (assetId: ID) => void;
  onMove: (assetId: ID, offset: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Markeert de eerste foto als cover van de video. */
  showCover?: boolean;
  label?: string;
  className?: string;
};

/**
 * De lijst met wat er geüpload is of wordt, in de volgorde waarin de foto's in
 * de video komen. De volgorde zit in de array zelf — verslepen is dus niets
 * meer dan een index die verhuist.
 */
export function UploadAssetList({
  assets,
  onRemove,
  onCancel,
  onRetry,
  onMove,
  onReorder,
  showCover = true,
  label = "Geüploade foto's, in volgorde",
  className,
}: UploadAssetListProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function handleDragStart(event: DragEvent<HTMLLIElement>, index: number) {
    event.dataTransfer.effectAllowed = "move";
    // De verplaatsing zit in de drag zelf, niet in state: tijdens `dragover`
    // is alleen het type leesbaar, en bij `drop` staat de index er nog exact
    // zoals hij vertrok. Ook Firefox wil een payload voor het slepen begint.
    event.dataTransfer.setData(REORDER_TYPE, String(index));
    event.dataTransfer.setData("text/plain", String(index));
    setDraggingIndex(index);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, index: number) {
    if (!event.dataTransfer.types.includes(REORDER_TYPE)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, index: number) {
    const raw = event.dataTransfer.getData(REORDER_TYPE);
    if (!raw) return;

    const fromIndex = Number(raw);
    if (!Number.isInteger(fromIndex)) return;

    event.preventDefault();
    // Niet naar de sleepzone laten doorlekken: dit is een verplaatsing, geen upload.
    event.stopPropagation();
    onReorder(fromIndex, index);
    handleDragEnd();
  }

  function handleDragEnd() {
    setDraggingIndex(null);
    setDropIndex(null);
  }

  return (
    <ol
      aria-label={label}
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}
    >
      {assets.map((asset, index) => (
        <UploadAssetCard
          key={asset.id}
          asset={asset}
          index={index}
          total={assets.length}
          showCover={showCover}
          isDragging={draggingIndex === index}
          isDropTarget={dropIndex === index && draggingIndex !== index}
          onRemove={onRemove}
          onCancel={onCancel}
          onRetry={onRetry}
          onMove={onMove}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
      ))}
    </ol>
  );
}
