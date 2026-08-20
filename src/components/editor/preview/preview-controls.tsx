"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { PreviewPlayback } from "@/components/editor/preview/use-preview-playback";
import { IconButton } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { PREVIEW_FPS, type PreviewPlan } from "@/lib/editor/preview-plan";
import { cn } from "@/lib/utils";

/**
 * De bediening onder het beeld: afspelen, opnieuw, en waar je zit.
 *
 * De balk toont ook waar de slides beginnen. Dat maakt van een streep een
 * kaart: je ziet dat er nog vier beelden komen en dat de tweede lang duurt,
 * zonder de strook eronder te lezen.
 *
 * Springen kan met de muis en met de pijltjestoetsen — een balk die alleen op
 * klikken reageert, sluit iedereen uit die met het toetsenbord werkt.
 */

/** Stap van de pijltjestoetsen. */
const STEP_SECONDS = 1;

export type PreviewControlsProps = {
  plan: PreviewPlan;
  playback: PreviewPlayback;
  /** Positie van de slide die nu speelt. */
  activeIndex: number;
  className?: string;
};

export function PreviewControls({ plan, playback, activeIndex, className }: PreviewControlsProps) {
  const duration = Math.max(plan.durationInSeconds, 0.001);
  const { seek } = playback;

  const seekFromPointer = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - bounds.left) / bounds.width;

      seek(Math.min(Math.max(ratio, 0), 1) * duration);
    },
    [duration, seek],
  );

  const seekFromKeyboard = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const jump: Record<string, number> = {
        ArrowLeft: playback.time - STEP_SECONDS,
        ArrowRight: playback.time + STEP_SECONDS,
        Home: 0,
        End: duration,
      };

      const next = jump[event.key];
      if (next === undefined) return;

      event.preventDefault();
      seek(next);
    },
    [duration, playback.time, seek],
  );

  return (
    <div className={cn("flex flex-col gap-2 px-3 py-2", className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Positie in de preview"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(playback.time)}
        aria-valuetext={`${formatDuration(playback.time)} van ${formatDuration(duration)}`}
        onClick={seekFromPointer}
        onKeyDown={seekFromKeyboard}
        className="group relative h-2 cursor-pointer rounded-full bg-surface-inset focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-full bg-brand"
          style={{ width: `${Math.min((playback.time / duration) * 100, 100)}%` }}
        />

        {/* Waar de slides beginnen; de eerste hoeft geen streep. */}
        {plan.slides.slice(1).map((slide) => (
          <span
            key={slide.id}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-canvas/70"
            style={{ left: `${(slide.startInSeconds / duration) * 100}%` }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <IconButton
          label={playback.isPlaying ? "Pauzeren" : "Afspelen"}
          variant="secondary"
          size="icon-sm"
          onClick={playback.toggle}
        >
          {playback.isPlaying ? <Pause /> : <Play />}
        </IconButton>

        <IconButton
          label="Opnieuw afspelen"
          variant="ghost"
          size="icon-sm"
          onClick={playback.restart}
        >
          <RotateCcw />
        </IconButton>

        <span className="text-xs text-fg-muted tabular-nums">
          {formatDuration(playback.time)} / {formatDuration(plan.durationInSeconds)}
        </span>

        {activeIndex >= 0 && plan.slides.length > 0 ? (
          <span className="truncate text-xs text-fg-subtle">
            {plan.slides[activeIndex]?.label} · slide {activeIndex + 1} van {plan.slides.length}
          </span>
        ) : null}

        <span className="ml-auto hidden shrink-0 text-[0.6875rem] text-fg-subtle tabular-nums sm:inline">
          {plan.size.height}p · {PREVIEW_FPS} fps
        </span>
      </div>
    </div>
  );
}
