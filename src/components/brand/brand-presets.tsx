"use client";

import { BRAND_PRESETS, type BrandPreset } from "@/lib/brand/kit";
import { cn } from "@/lib/utils";

/**
 * Startpunten voor wie nog geen kleuren heeft.
 *
 * Een klik zet twee kleuren en een lettertype, meer niet — daarna is alles nog
 * gewoon aanpasbaar. Bewust geen "gekozen"-staat: zodra je één kleur wijzigt,
 * is het jouw huisstijl en niet meer die van het startpunt, en een vinkje dat
 * dan blijft staan zou liegen.
 */

export type BrandPresetsProps = {
  onApply: (preset: BrandPreset) => void;
  disabled?: boolean;
  className?: string;
};

export function BrandPresets({ onApply, disabled = false, className }: BrandPresetsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {BRAND_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={disabled}
          onClick={() => onApply(preset)}
          title={preset.description}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 text-left",
            "transition-[border-color,background-color] duration-150",
            "hover:border-border-strong hover:bg-surface-subtle",
            "disabled:pointer-events-none disabled:opacity-55",
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: preset.primaryColor }}
          >
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: preset.secondaryColor }}
            />
          </span>
          <span className="min-w-0 truncate text-xs font-medium text-fg">{preset.name}</span>
        </button>
      ))}
    </div>
  );
}
