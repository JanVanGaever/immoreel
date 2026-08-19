"use client";

import type { MouseEvent } from "react";
import {
  EASING_OPTIONS,
  getMotionOption,
  MAX_SPEED,
  MIN_SPEED,
  zoomFraction,
} from "@/lib/editor/motion";
import { formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MotionEasing, SceneMotion } from "@/types";

/**
 * Zelf afstellen: hoever, hoe snel, hoe zacht, en waarnaartoe.
 *
 * Elke regelaar zegt wat hij dóét in plaats van welk getal hij is. "0,45"
 * betekent niets; "komt tot 45 % van het traject — traag en drijvend" wel. Dat
 * is hier belangrijker dan elders, want tempo en sterkte lijken op elkaar
 * zolang je alleen de cijfers ziet: sterkte is hoe ver de camera zou reizen,
 * tempo is hoeveel van die reis binnen deze scène past.
 */

export type MotionControlsProps = {
  motion: SceneMotion;
  onChange: (changes: Partial<SceneMotion>) => void;
  /** Lengte van de scène; nodig om het tempo in seconden uit te drukken. */
  durationInSeconds: number;
  className?: string;
};

export function MotionControls({
  motion,
  onChange,
  durationInSeconds,
  className,
}: MotionControlsProps) {
  const option = getMotionOption(motion.kind);
  const isStill = motion.kind === "geen";
  const percentage = Math.round(zoomFraction(motion.intensity) * 100);

  function handleFocusClick(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    onChange({
      focusX: Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1),
      focusY: Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1),
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <label className="block">
        <span className="mb-1 flex items-baseline justify-between gap-2 text-[0.6875rem] text-fg-muted">
          Sterkte
          <span className="font-medium text-fg tabular-nums">{percentage} % groter</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={motion.intensity}
          disabled={isStill}
          aria-label="Sterkte van de beweging"
          onChange={(event) => onChange({ intensity: Number(event.target.value) })}
          className="w-full accent-[var(--color-brand)] disabled:opacity-50"
        />
      </label>

      <label className="block">
        <span className="mb-1 flex items-baseline justify-between gap-2 text-[0.6875rem] text-fg-muted">
          Tempo
          <span className="font-medium text-fg tabular-nums">{motion.speed.toFixed(2)}×</span>
        </span>
        <input
          type="range"
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={0.05}
          value={motion.speed}
          disabled={isStill}
          aria-label="Tempo van de beweging"
          onChange={(event) => onChange({ speed: Number(event.target.value) })}
          className="w-full accent-[var(--color-brand)] disabled:opacity-50"
        />
        <span className="mt-1 block text-[0.6875rem] leading-relaxed text-fg-subtle">
          {describeSpeed(motion.speed, durationInSeconds)}
        </span>
      </label>

      <div>
        <p className="mb-1 text-[0.6875rem] text-fg-muted">Versnelling</p>
        <div role="group" aria-label="Versnelling" className="grid grid-cols-2 gap-1">
          {EASING_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={isStill}
              onClick={() => onChange({ easing: item.id as MotionEasing })}
              aria-pressed={motion.easing === item.id}
              title={item.description}
              className={cn(
                "h-7 rounded-md border text-[0.6875rem] font-medium",
                "transition-[border-color,background-color] duration-150 disabled:opacity-50",
                motion.easing === item.id
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-surface text-fg-muted hover:border-border-strong",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {option.usesFocus ? (
        <div>
          <p className="mb-1.5 text-[0.6875rem] text-fg-muted">
            Focuspunt — klik waar de beweging naartoe werkt
          </p>
          <button
            type="button"
            onClick={handleFocusClick}
            aria-label={`Focuspunt: ${Math.round(motion.focusX * 100)} % van links, ${Math.round(motion.focusY * 100)} % van boven`}
            className="surface-grid relative aspect-video w-full rounded-md border border-border bg-surface"
          >
            <span
              aria-hidden="true"
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-surface"
              style={{ left: `${motion.focusX * 100}%`, top: `${motion.focusY * 100}%` }}
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Het tempo in gewone taal, met de lengte van deze scène erin verrekend. */
function describeSpeed(speed: number, durationInSeconds: number): string {
  if (Math.abs(speed - 1) < 0.03) return "De beweging vult de scène precies.";

  if (speed < 1) {
    return `Komt tot ${Math.round(speed * 100)} % van het traject — traag en drijvend.`;
  }

  return `Klaar na ${formatSeconds(
    Math.round((durationInSeconds / speed) * 10) / 10,
  )}, daarna staat het beeld stil.`;
}
