"use client";

import { ASPECT_RATIO_OPTIONS, aspectRatioCss } from "@/lib/aspect-ratios";
import { cn } from "@/lib/utils";
import type { AspectRatio } from "@/types";

/**
 * De beeldverhouding van de video.
 *
 * Elke keuze toont haar eigen vorm: "9:16" zegt minder dan een staand kader.
 * Een ander formaat kan het gekozen template ongeldig maken; de reducer
 * schuift dan naar het dichtstbijzijnde dat wél past, net als in de wizard.
 */
export function AspectRatioSelector({
  value,
  onChange,
}: {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
}) {
  return (
    <div role="group" aria-label="Beeldverhouding" className="grid grid-cols-4 gap-1.5">
      {ASPECT_RATIO_OPTIONS.map((option) => {
        const isActive = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={isActive}
            title={option.description}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-md border p-2",
              "transition-[border-color,background-color] duration-150",
              isActive
                ? "border-brand bg-brand-soft text-brand"
                : "border-border bg-surface text-fg-muted hover:border-border-strong",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "w-full max-w-7 rounded-sm border",
                isActive ? "border-brand bg-brand/15" : "border-border-strong",
              )}
              style={{ aspectRatio: aspectRatioCss(option.id) }}
            />
            <span className="text-[0.625rem] font-medium tabular-nums">{option.id}</span>
          </button>
        );
      })}
    </div>
  );
}
