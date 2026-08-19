"use client";

import { MotionThumbnail } from "@/components/editor/motion/motion-thumbnail";
import { matchMotionPreset, MOTION_PRESETS, presetMotionChanges } from "@/lib/editor/motion";
import { cn } from "@/lib/utils";
import type { MotionKind, SceneMotion } from "@/types";

/**
 * De tien kant-en-klare bewegingen.
 *
 * Elke kaart tekent haar eigen traject mét het focuspunt van déze foto, zodat
 * je ziet wat je krijgt en niet wat het gemiddelde geval zou zijn. Om dezelfde
 * reden zet een preset het focuspunt ook niet terug: waar de aandacht in een
 * foto ligt, hoort bij de foto en niet bij de beweging.
 */

export type MotionPresetGridProps = {
  motion: SceneMotion;
  onSelect: (motion: SceneMotion) => void;
  /** Bewegingen die het gekozen template afraadt; blijven wel kiesbaar. */
  discouraged?: MotionKind[];
  className?: string;
};

export function MotionPresetGrid({
  motion,
  onSelect,
  discouraged = [],
  className,
}: MotionPresetGridProps) {
  const active = matchMotionPreset(motion);

  return (
    <div role="group" aria-label="Beweging" className={cn("grid grid-cols-2 gap-1.5", className)}>
      {MOTION_PRESETS.map((preset) => {
        // Het focuspunt van deze foto blijft staan; de rest komt uit de preset.
        const next: SceneMotion = { ...motion, ...presetMotionChanges(preset) };
        const isActive = active?.id === preset.id;
        const isDiscouraged = discouraged.includes(preset.motion.kind);

        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(next)}
            aria-pressed={isActive}
            title={
              isDiscouraged
                ? `${preset.label} — ${preset.description} Past minder bij dit template.`
                : `${preset.label} — ${preset.description}`
            }
            className={cn(
              "flex items-center gap-2 rounded-md border p-1.5 text-left",
              "transition-[border-color,background-color,color] duration-150",
              isActive
                ? "border-brand bg-brand-soft text-brand"
                : "border-border bg-surface text-fg-muted hover:border-border-strong",
              isDiscouraged && !isActive && "opacity-60",
            )}
          >
            <MotionThumbnail motion={next} className="w-9 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-medium">
              {preset.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
