"use client";

import { ImageOff, Play } from "lucide-react";
import { MotionThumbnail } from "@/components/editor/motion/motion-thumbnail";
import {
  useMotionLoop,
  usePrefersReducedMotion,
} from "@/components/editor/motion/use-motion-loop";
import { Button } from "@/components/ui/button";
import { aspectRatioCss } from "@/lib/aspect-ratios";
import { describeMotion, motionStyleAt } from "@/lib/editor/motion";
import { formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AspectRatio, SceneMotion } from "@/types";

/**
 * De beweging in het klein, met de foto zelf erin.
 *
 * Dit is waarom de instellingen te begrijpen zijn zonder ze te renderen: het
 * kadert dezelfde uitsnede, op dezelfde tijdlijn, met dezelfde functie als de
 * grote preview en straks de render (`motionStyleAt`). Wat hier langsschuift,
 * schuift daar ook langs.
 *
 * De lus loopt zolang dit paneel open staat en begint opnieuw bij elke
 * wijziging — het verschil tussen tempo 0,5 en 0,8 zie je alleen door het te
 * zien. Wie liever geen bewegende beelden krijgt, houdt een stilstaand
 * eindbeeld met een knop ernaast.
 */

export type MotionMiniPreviewProps = {
  motion: SceneMotion;
  durationInSeconds: number;
  /** De foto van deze scène; zonder opslag is dat er nog niet altijd. */
  previewUrl?: string | null;
  aspectRatio?: AspectRatio;
  className?: string;
};

export function MotionMiniPreview({
  motion,
  durationInSeconds,
  previewUrl,
  aspectRatio = "16:9",
  className,
}: MotionMiniPreviewProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { progress, playOnce } = useMotionLoop({
    durationInSeconds,
    loop: !reducedMotion,
    // Bij elke wijziging opnieuw beginnen; anders zie je de nieuwe waarde pas
    // aan het einde van de lopende doorloop.
    restartKey: `${JSON.stringify(motion)}:${durationInSeconds}`,
  });

  const style = motionStyleAt(motion, progress);
  // Boven tempo 1 is de beweging vroeger klaar; die grens tekenen we op de
  // balk, zodat het stilstaande stuk aan het einde geen vergissing lijkt.
  const settleAt = motion.speed > 1 ? Math.min(1 / motion.speed, 1) : null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Vaste hoogte, breedte uit de beeldverhouding: anders vult een staand
          9:16-kader het halve paneel en verdwijnen de presets onder de vouw. */}
      <div className="flex h-28 items-center justify-center gap-2">
        <div
          className="relative h-full max-w-full overflow-hidden rounded-md border border-border bg-black"
          style={{ aspectRatio: aspectRatioCss(aspectRatio) }}
        >
          {previewUrl ? (
            // Blob-URL uit de browser van de gebruiker: daar valt voor
            // next/image niets aan te optimaliseren.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              draggable={false}
              className="size-full object-cover will-change-transform"
              style={style}
            />
          ) : (
            <div
              className="surface-grid flex size-full items-center justify-center bg-surface-inset text-fg-subtle will-change-transform"
              style={style}
            >
              <ImageOff aria-hidden="true" className="size-4" />
            </div>
          )}
        </div>

        <MotionThumbnail motion={motion} className="w-11 shrink-0 text-brand" />
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-inset">
        <div
          className="relative h-full rounded-full bg-brand transition-none"
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
        {settleAt ? (
          <div
            aria-hidden="true"
            className="relative -mt-1 h-1 w-px bg-fg-subtle"
            style={{ marginLeft: `${settleAt * 100}%` }}
          />
        ) : null}
      </div>

      <p className="flex items-center justify-between gap-2 text-[0.6875rem] text-fg-subtle">
        <span className="truncate">{describeMotion(motion)}</span>
        <span className="shrink-0 tabular-nums">{formatSeconds(durationInSeconds)}</span>
      </p>

      {reducedMotion ? (
        <Button variant="secondary" size="sm" className="w-full" onClick={playOnce}>
          <Play />
          Beweging afspelen
        </Button>
      ) : null}
    </div>
  );
}
