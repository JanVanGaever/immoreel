"use client";

import { Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import {
  clampSceneSeconds,
  MAX_SCENE_SECONDS,
  MIN_SCENE_SECONDS,
  SCENE_SECONDS_STEP,
} from "@/lib/editor/document";
import { formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * De duur van een scène, in twee maten.
 *
 * Beide gaan door `clampSceneSeconds()`, dezelfde functie die de reducer en de
 * server gebruiken. Een waarde buiten de grenzen bestaat dus nergens, ook niet
 * even.
 */

export type DurationStepperProps = {
  seconds: number;
  onChange: (seconds: number) => void;
  /** Toegankelijke naam; in de lijst staat er geen zichtbaar label. */
  label: string;
  className?: string;
};

/** Compacte versie voor in de assetlijst: min, waarde, plus. */
export function DurationStepper({ seconds, onChange, label, className }: DurationStepperProps) {
  return (
    <span
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-surface",
        className,
      )}
    >
      <IconButton
        label="Korter"
        variant="ghost"
        size="icon-sm"
        className="size-6 rounded-r-none"
        disabled={seconds <= MIN_SCENE_SECONDS}
        onClick={() => onChange(clampSceneSeconds(seconds - SCENE_SECONDS_STEP))}
      >
        <Minus className="size-3" />
      </IconButton>
      <span className="min-w-11 text-center text-[0.6875rem] font-medium text-fg tabular-nums">
        {formatSeconds(seconds)}
      </span>
      <IconButton
        label="Langer"
        variant="ghost"
        size="icon-sm"
        className="size-6 rounded-l-none"
        disabled={seconds >= MAX_SCENE_SECONDS}
        onClick={() => onChange(clampSceneSeconds(seconds + SCENE_SECONDS_STEP))}
      >
        <Plus className="size-3" />
      </IconButton>
    </span>
  );
}

export type DurationSliderProps = {
  seconds: number;
  onChange: (seconds: number) => void;
  label?: string;
  /** Tekst onder de regelaar, bijvoorbeeld hoeveel scènes dit raakt. */
  hint?: string;
  className?: string;
};

/** Volledige versie voor het rechterpaneel: regelaar met de waarde ernaast. */
export function DurationSlider({
  seconds,
  onChange,
  label = "Duur",
  hint,
  className,
}: DurationSliderProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs text-fg-muted">{label}</span>
        <span className="text-xs font-medium text-fg tabular-nums">{formatSeconds(seconds)}</span>
      </div>
      <input
        type="range"
        min={MIN_SCENE_SECONDS}
        max={MAX_SCENE_SECONDS}
        step={SCENE_SECONDS_STEP}
        value={seconds}
        aria-label={label}
        onChange={(event) => onChange(clampSceneSeconds(Number(event.target.value)))}
        className="w-full accent-[var(--color-brand)]"
      />
      {hint ? <p className="mt-1 text-[0.6875rem] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
