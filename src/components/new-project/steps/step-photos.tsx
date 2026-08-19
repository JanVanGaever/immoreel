"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Trash2, Upload } from "lucide-react";
import type { AddPhotosResult, PhotoRejection } from "@/components/new-project/use-project-draft";
import { Alert } from "@/components/ui/alert";
import { Button, IconButton } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { formatBytes } from "@/lib/format";
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTOS, MIN_PHOTOS } from "@/lib/new-project/validation";
import { cn } from "@/lib/utils";
import type { DraftPhoto, ID } from "@/types";

/** Ook de extensies erbij: HEIC krijgt niet in elke browser een mimetype mee. */
const ACCEPT = [...ACCEPTED_PHOTO_TYPES, ".heic", ".heif"].join(",");

export type StepPhotosProps = {
  photos: DraftPhoto[];
  /** Richtlijn uit de preset van het gekozen doel. */
  recommendedPhotos: number;
  /** Aantal foto's in het teruggehaalde concept; die zijn niet mee bewaard. */
  restoredPhotoCount: number | null;
  error?: string;
  onAdd: (files: File[]) => AddPhotosResult;
  onRemove: (photoId: ID) => void;
  onMove: (photoId: ID, offset: number) => void;
};

/** Stap 5: de foto's. De volgorde hier is de volgorde in de video. */
export function StepPhotos({
  photos,
  recommendedPhotos,
  restoredPhotoCount,
  error,
  onAdd,
  onRemove,
  onMove,
}: StepPhotosProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<PhotoRejection[]>([]);

  const totalBytes = photos.reduce((sum, photo) => sum + photo.sizeInBytes, 0);
  const isFull = photos.length >= MAX_PHOTOS;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const result: AddPhotosResult = onAdd([...files]);
    setRejected(result.rejected);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files);
    // Leegmaken, anders wordt hetzelfde bestand een tweede keer genegeerd.
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-4">
      {restoredPhotoCount && photos.length === 0 ? (
        <Alert variant="warning" title="Je foto's zijn niet mee bewaard">
          Het teruggehaalde concept had er {restoredPhotoCount}. Foto&apos;s blijven op je eigen
          toestel tot je het project aanmaakt, dus voeg ze hier opnieuw toe.
        </Alert>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center rounded-xl border border-dashed px-6 py-8 text-center",
          "transition-[border-color,background-color] duration-150",
          isDragging ? "border-brand bg-brand-soft/50" : "border-border bg-surface/60",
        )}
      >
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-subtle text-fg-subtle">
          <ImageIcon className="size-5" />
        </span>
        <p className="text-sm font-semibold text-fg">Sleep de foto&apos;s hierheen</p>
        <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
          JPG, PNG, WebP of HEIC, tot 25 MB per foto. Minstens {MIN_PHOTOS}, maximaal {MAX_PHOTOS}.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={handleInput}
        />
        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => inputRef.current?.click()}
          disabled={isFull}
        >
          <Upload />
          Foto&apos;s kiezen
        </Button>
      </div>

      {rejected.length > 0 ? (
        <Alert variant="warning" title={`${rejected.length} bestand(en) overgeslagen`}>
          <ul className="mt-1 space-y-0.5">
            {rejected.slice(0, 5).map((item) => (
              <li key={`${item.fileName}-${item.reason}`}>
                {item.fileName} — {item.reason}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {photos.length > 0 ? (
        <>
          <Meter
            value={photos.length}
            max={Math.max(recommendedPhotos, MIN_PHOTOS)}
            tone={photos.length >= MIN_PHOTOS ? "success" : "warning"}
            label={`${photos.length} ${photos.length === 1 ? "foto" : "foto's"} · ${formatBytes(totalBytes)}`}
            valueLabel={`Aanbevolen: ${recommendedPhotos}`}
          />

          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                className="group relative overflow-hidden rounded-lg border border-border bg-surface-subtle"
              >
                <span className="flex aspect-[4/3] items-center justify-center">
                  {photo.previewUrl ? (
                    // Blob-URL uit de browser van de gebruiker: die kan next/image
                    // niet optimaliseren, en er valt hier ook niets te optimaliseren.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.previewUrl}
                      alt={photo.fileName}
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageIcon aria-hidden="true" className="size-5 text-fg-subtle" />
                  )}
                </span>

                <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-fg/75 px-2 py-0.5 text-[0.6875rem] font-semibold text-fg-inverted">
                  {index + 1}
                  {index === 0 ? <span className="font-medium">· cover</span> : null}
                </span>

                <span className="absolute right-2 bottom-2 flex gap-1">
                  <IconButton
                    label={`${photo.fileName} naar voren`}
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => onMove(photo.id, -1)}
                    disabled={index === 0}
                  >
                    <ChevronLeft />
                  </IconButton>
                  <IconButton
                    label={`${photo.fileName} naar achteren`}
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => onMove(photo.id, 1)}
                    disabled={index === photos.length - 1}
                  >
                    <ChevronRight />
                  </IconButton>
                  <IconButton
                    label={`${photo.fileName} verwijderen`}
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => onRemove(photo.id)}
                  >
                    <Trash2 />
                  </IconButton>
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
