"use client";

import { useEffect, useRef } from "react";
import { formatSeconds } from "@/lib/format";
import type { PreviewPlan } from "@/lib/editor/preview-plan";
import { cn } from "@/lib/utils";

/**
 * De slides onder de speler: welke er nu speelt, en hoelang elke duurt.
 *
 * Bewust niet op schaal zoals de tijdlijn in de editor. Die laat de verhouding
 * tussen scènes zien; dit beantwoordt een andere vraag — "waar zit ik, en hoe
 * lang blijft deze foto staan?" Een blok van één seconde moet daarvoor breed
 * genoeg blijven om zijn duur te kunnen tonen.
 *
 * Klikken springt naar het begin van een slide. Dat is bij het nakijken van een
 * video de enige navigatie die je echt nodig hebt: opnieuw kijken naar die ene
 * overgang, zonder de rest af te wachten.
 */

export type PreviewSlidesProps = {
  plan: PreviewPlan;
  /** Positie van de slide die nu speelt. */
  activeIndex: number;
  /** Hoever die slide staat, van 0 tot 1. */
  progress: number;
  onSelect: (startInSeconds: number) => void;
  className?: string;
};

export function PreviewSlides({
  plan,
  activeIndex,
  progress,
  onSelect,
  className,
}: PreviewSlidesProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  // De speler loopt door; de strook moet meelopen, anders kijk je halverwege
  // naar slides die allang voorbij zijn.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeIndex]);

  if (plan.slides.length === 0) return null;

  return (
    <ol
      aria-label="Slides in de preview"
      className={cn("flex gap-1.5 overflow-x-auto px-3 py-2", className)}
    >
      {plan.slides.map((slide, index) => {
        const isActive = index === activeIndex;
        const isScene = slide.kind === "scene";

        return (
          <li key={slide.id} className="shrink-0">
            <button
              ref={isActive ? activeRef : null}
              type="button"
              onClick={() => onSelect(slide.startInSeconds)}
              aria-current={isActive || undefined}
              title={`${slide.label} · ${formatSeconds(slide.durationInSeconds)}`}
              className={cn(
                "relative flex w-24 flex-col gap-0.5 overflow-hidden rounded-md border px-2 py-1.5 text-left",
                "transition-[border-color,background-color] duration-150",
                isScene
                  ? "border-border bg-surface hover:border-border-strong"
                  : "border-dashed border-border-strong bg-surface-subtle",
                isActive && "border-brand bg-brand-soft ring-1 ring-brand/40",
              )}
            >
              <span
                className={cn(
                  "truncate text-[0.6875rem] font-medium",
                  isActive ? "text-brand" : "text-fg-muted",
                )}
              >
                {slide.label}
              </span>
              <span className="text-[0.6875rem] text-fg-subtle tabular-nums">
                {formatSeconds(slide.durationInSeconds)}
              </span>

              {/* De voortgang binnen deze slide; alleen op de slide die speelt. */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand",
                  !isActive && "hidden",
                )}
                style={{ transform: `scaleX(${progress.toFixed(3)})` }}
              />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
