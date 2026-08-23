"use client";

import type { DragEvent, MouseEvent } from "react";
import { ChevronDown, ChevronUp, GripVertical, ImageIcon, RotateCcw, Trash2 } from "lucide-react";
import { MotionThumbnail } from "@/components/editor/motion/motion-thumbnail";
import { DurationStepper } from "@/components/editor/panels/duration-field";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import type { EditorScene } from "@/lib/editor/document";
import {
  describeMotion,
  findMotionPreset,
  matchMotionPreset,
  MOTION_PRESETS,
  presetMotionChanges,
} from "@/lib/editor/motion";
import type { SelectMode } from "@/lib/editor/state";
import { cn } from "@/lib/utils";
import type { ID, SceneMotion } from "@/types";

export type AssetRowProps = {
  scene: EditorScene;
  index: number;
  total: number;
  isActive: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onSelect: (sceneId: ID, mode: SelectMode) => void;
  onRemove: (sceneId: ID) => void;
  onRetry: (sceneId: ID) => void;
  onMove: (sceneId: ID, offset: number) => void;
  onDuration: (sceneId: ID, seconds: number) => void;
  onMotion: (sceneId: ID, changes: Partial<SceneMotion>) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>, index: number) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>, index: number) => void;
  onDrop: (event: DragEvent<HTMLLIElement>, index: number) => void;
  onDragEnd: () => void;
};

/**
 * Eén foto in de lijst links: het beeld, de plaats in de volgorde, hoe lang ze
 * in beeld blijft en hoe de camera beweegt.
 *
 * De twee instellingen die je het vaakst wijzigt staan hier, niet alleen in
 * het rechterpaneel: een video van veertien foto's maak je niet door veertien
 * keer heen en weer te klikken.
 *
 * Verslepen werkt met de muis; de pijlknoppen doen hetzelfde met toetsenbord
 * en op een touchscreen, waar HTML5-slepen niet bestaat.
 */
export function AssetRow({
  scene,
  index,
  total,
  isActive,
  isSelected,
  isDragging,
  isDropTarget,
  onSelect,
  onRemove,
  onRetry,
  onMove,
  onDuration,
  onMotion,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: AssetRowProps) {
  const { source } = scene;
  const isUploading = source.status === "uploaden";
  const hasFailed = source.status === "mislukt";
  // Een eigen afstelling hoort bij geen enkele preset; die krijgt haar eigen
  // regel in de lijst in plaats van stilzwijgend als preset te tonen.
  const preset = matchMotionPreset(scene.motion);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // Dezelfde toetsen als in elke bestandslijst: shift voor een reeks,
    // ctrl of cmd om er één bij te pikken.
    const mode: SelectMode = event.shiftKey
      ? "bereik"
      : event.metaKey || event.ctrlKey
        ? "toevoegen"
        : "vervang";

    onSelect(scene.id, mode);
  }

  return (
    <li
      draggable
      onDragStart={(event) => onDragStart(event, index)}
      onDragOver={(event) => onDragOver(event, index)}
      onDrop={(event) => onDrop(event, index)}
      onDragEnd={onDragEnd}
      aria-current={isActive || undefined}
      className={cn(
        "group relative rounded-lg border bg-surface p-2",
        "transition-[border-color,box-shadow,opacity] duration-150",
        hasFailed ? "border-danger/40" : "border-border",
        isActive && "border-brand ring-1 ring-brand/30",
        isSelected && "bg-brand-soft/40",
        isDragging && "opacity-40",
        isDropTarget && "border-brand ring-2 ring-brand/40",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-3 cursor-grab text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 max-lg:opacity-100"
        >
          <GripVertical className="size-4" />
        </span>

        <button
          type="button"
          onClick={handleClick}
          aria-pressed={isSelected}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <span className="relative flex aspect-[4/3] w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-inset">
            {source.previewUrl ? (
              // Blob-URL uit de browser van de gebruiker: daar valt voor
              // next/image niets aan te optimaliseren.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={source.previewUrl}
                alt=""
                draggable={false}
                className={cn("size-full object-cover", isUploading && "opacity-60")}
              />
            ) : (
              <ImageIcon aria-hidden="true" className="size-4 text-fg-subtle" />
            )}
            <span className="absolute top-0.5 left-0.5 rounded bg-fg/70 px-1 text-[0.625rem] font-semibold text-fg-inverted tabular-nums">
              {index + 1}
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-fg">{source.fileName}</span>
            <span className="mt-0.5 block truncate text-[0.6875rem] text-fg-subtle">
              {describeMotion(scene.motion)}
              {scene.captionTop || scene.captionBottom ? " · bijschrift" : null}
            </span>
            {isUploading ? (
              <Meter
                value={source.progress}
                max={100}
                size="sm"
                srLabel={`Upload van ${source.fileName}`}
                className="mt-1.5"
              />
            ) : null}
            {hasFailed ? (
              <Badge size="sm" variant="danger" className="mt-1">
                {source.error ?? "Mislukt"}
              </Badge>
            ) : null}
          </span>
        </button>

        <span className="flex shrink-0 flex-col gap-0.5">
          <IconButton
            label={`${source.fileName} naar boven`}
            variant="ghost"
            size="icon-sm"
            disabled={index === 0}
            onClick={() => onMove(scene.id, -1)}
          >
            <ChevronUp />
          </IconButton>
          <IconButton
            label={`${source.fileName} naar beneden`}
            variant="ghost"
            size="icon-sm"
            disabled={index === total - 1}
            onClick={() => onMove(scene.id, 1)}
          >
            <ChevronDown />
          </IconButton>
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 pl-6">
        <DurationStepper
          seconds={scene.durationInSeconds}
          onChange={(seconds) => onDuration(scene.id, seconds)}
          label={`Duur van ${source.fileName}`}
        />

        {/* Het traject in het klein: op een lijst van veertien foto's zie je zo
            in één blik welke kant elke scène op beweegt. */}
        <MotionThumbnail motion={scene.motion} className="w-7 shrink-0 text-brand" />

        <select
          value={preset?.id ?? ""}
          onChange={(event) => {
            const chosen = findMotionPreset(event.target.value);
            if (chosen) onMotion(scene.id, presetMotionChanges(chosen));
          }}
          aria-label={`Beweging van ${source.fileName}`}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-surface px-1.5 text-[0.6875rem] text-fg hover:border-border-strong focus:border-brand focus:outline-none"
        >
          {preset ? null : (
            <option value="" disabled>
              Aangepast
            </option>
          )}
          {MOTION_PRESETS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Opnieuw proberen kan alleen zolang het bestand nog in dit tabblad
            zit (`uploadId`). Bij een scène die uit de databank komt met een
            mislukte upload erachter is het bestand weg: dan is deze knop een
            belofte die niets doet, en blijft alleen verwijderen over. */}
        {hasFailed && source.uploadId ? (
          <IconButton
            label={`${source.fileName} opnieuw uploaden`}
            variant="ghost"
            size="icon-sm"
            onClick={() => onRetry(scene.id)}
          >
            <RotateCcw />
          </IconButton>
        ) : null}

        <IconButton
          label={`${source.fileName} verwijderen`}
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(scene.id)}
        >
          <Trash2 />
        </IconButton>
      </div>
    </li>
  );
}
