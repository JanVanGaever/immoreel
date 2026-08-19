"use client";

import { useId, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { ImagePlus, Upload, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptAttribute, PHOTO_UPLOAD_CONSTRAINTS, type UploadConstraints } from "@/lib/uploads/validation";
import { cn } from "@/lib/utils";

export type UploadZoneProps = {
  /** Wat de gebruiker gekozen of gesleept heeft; validatie gebeurt verderop. */
  onFiles: (files: File[]) => void;
  constraints?: UploadConstraints;
  /** Uit wanneer de lijst vol is of het scherm alleen-lezen is. */
  disabled?: boolean;
  /** Reden waarom er niets meer bij kan; vervangt de standaardtekst. */
  disabledReason?: string;
  icon?: LucideIcon;
  title?: string;
  description?: ReactNode;
  buttonLabel?: string;
  /** Smalle balk voor onder een lijst die al gevuld is. */
  compact?: boolean;
  className?: string;
};

/**
 * Het sleepveld. Weet niets van uploads of van wat er al in de lijst staat:
 * het levert alleen bestanden af. Daardoor is dezelfde zone bruikbaar in de
 * wizard, in de mediabibliotheek en later in de editor.
 *
 * Slepen werkt op desktop; op een tablet of telefoon opent de knop de
 * bestandskiezer, die daar ook de camera en de fotorol aanbiedt.
 */
export function UploadZone({
  onFiles,
  constraints = PHOTO_UPLOAD_CONSTRAINTS,
  disabled = false,
  disabledReason,
  icon: Icon = ImagePlus,
  title = "Sleep je foto's hierheen",
  description,
  buttonLabel = "Foto's kiezen",
  compact = false,
  className,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  /**
   * Tellen in plaats van een boolean: `dragleave` vuurt ook bij elk kind
   * waar de cursor overheen gaat, en de rand zou dan blijven knipperen.
   */
  const depth = useRef(0);
  const [isDragging, setDragging] = useState(false);

  const hint =
    description ??
    `${constraints.label}, tot ${Math.round(constraints.maxBytes / (1024 * 1024))} MB per bestand. Maximaal ${constraints.maxFiles} foto's.`;

  function openPicker() {
    if (disabled) return;

    inputRef.current?.click();
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    onFiles([...(event.target.files ?? [])]);
    // Leegmaken, anders wordt hetzelfde bestand een tweede keer genegeerd.
    event.target.value = "";
  }

  /** Het slepen van een kaart binnen de lijst is geen upload. */
  function hasFiles(event: DragEvent<HTMLDivElement>) {
    return event.dataTransfer.types.includes("Files");
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (disabled || !hasFiles(event)) return;

    depth.current += 1;
    setDragging(true);
  }

  function handleDragLeave() {
    depth.current = Math.max(depth.current - 1, 0);
    if (depth.current === 0) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (disabled || !hasFiles(event)) return;

    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    onFiles([...event.dataTransfer.files]);
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={(event) => {
        if (disabled || !hasFiles(event)) return;
        // Zonder dit opent de browser de foto in een nieuw tabblad.
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openPicker}
      data-dragging={isDragging || undefined}
      className={cn(
        "rounded-xl border border-dashed transition-[border-color,background-color] duration-150",
        compact
          ? "flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          : "flex flex-col items-center px-6 py-10 text-center",
        isDragging ? "border-brand bg-brand-soft/50" : "border-border bg-surface/60",
        disabled ? "opacity-60" : "cursor-pointer hover:border-border-strong",
        className,
      )}
    >
      {compact ? (
        <p className="flex min-w-0 items-center gap-2 text-sm text-fg-muted">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
          <span className="truncate">{disabled ? (disabledReason ?? title) : title}</span>
        </p>
      ) : (
        <>
          <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-subtle text-fg-subtle">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <p className="text-sm font-semibold text-fg">{title}</p>
          <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
            {disabled ? (disabledReason ?? hint) : hint}
          </p>
        </>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptAttribute(constraints)}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={handleInput}
      />
      <Button
        variant="secondary"
        size={compact ? "sm" : "md"}
        disabled={disabled}
        className={compact ? undefined : "mt-5"}
        // De hele zone is klikbaar; zonder dit opent de kiezer twee keer.
        onClick={(event) => {
          event.stopPropagation();
          openPicker();
        }}
      >
        <Upload />
        {buttonLabel}
      </Button>
    </div>
  );
}
