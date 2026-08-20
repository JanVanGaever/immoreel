"use client";

import { BrandMark } from "@/components/brand/end-card-preview";
import { logoPlacementClassName } from "@/lib/editor/branding";
import { aspectRatioCss } from "@/lib/aspect-ratios";
import { cn } from "@/lib/utils";
import type { AspectRatio, LogoPlacement, ResolvedBrand } from "@/types";

/**
 * Het watermerk over een scène.
 *
 * De foto eronder is bewust geen echte foto: die hoort bij een project, en
 * deze pagina gaat over de huisstijl. Wat je wél moet kunnen beoordelen is of
 * je logo leesbaar blijft op iets wat van licht naar donker loopt — vandaar
 * het verloop in plaats van een egaal vlak.
 */

export type WatermarkPreviewProps = {
  brand: ResolvedBrand;
  aspectRatio: AspectRatio;
  placement?: LogoPlacement;
  className?: string;
};

export function WatermarkPreview({
  brand,
  aspectRatio,
  placement = "rechtsonder",
  className,
}: WatermarkPreviewProps) {
  return (
    <div
      className={cn(
        "@container relative isolate overflow-hidden rounded-xl border border-border shadow-elevated",
        className,
      )}
      style={{ aspectRatio: aspectRatioCss(aspectRatio) }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-slate-200 via-slate-400 to-slate-800 dark:from-slate-300 dark:via-slate-500 dark:to-slate-900"
      />
      <span aria-hidden="true" className="surface-grid absolute inset-0 opacity-25" />

      <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-[clamp(0.5rem,2.4cqw,0.875rem)] text-white/70 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
        Een scène uit de video
      </p>

      {brand.showWatermark ? (
        // Alleen positioneren; het merkteken brengt zijn eigen vlak mee, zodat
        // een logo mét transparantie en initialen zónder er allebei goed uitzien.
        <span
          className={cn(
            "absolute flex aspect-square w-[13%] min-w-8 items-center justify-center",
            "drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]",
            logoPlacementClassName(placement),
          )}
        >
          <BrandMark
            brand={brand}
            className="size-full max-h-full max-w-full text-[clamp(0.5rem,3.5cqw,1rem)]"
          />
        </span>
      ) : null}
    </div>
  );
}
