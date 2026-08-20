"use client";

import { ImageOff } from "lucide-react";
import { findScene, type EditorDocument, type TimelineSegment } from "@/lib/editor/document";
import { BrandMark, EndCardPreview } from "@/components/brand/end-card-preview";
import { resolveBrand } from "@/lib/brand/kit";
import { logoPlacementClassName } from "@/lib/editor/branding";
import { motionStyleAt } from "@/lib/editor/motion";
import { aspectRatioCss } from "@/lib/aspect-ratios";
import { cn } from "@/lib/utils";

/**
 * Het beeld zoals het gerenderd wordt.
 *
 * Er wordt niets voorbereid en niets gecachet: bij elk beeldje leest deze
 * component af waar de afspeelkop staat en zet de foto in de bijbehorende
 * stand. Een instelling wijzigen is daardoor meteen zichtbaar — er is geen
 * tussenresultaat dat eerst opnieuw gemaakt moet worden.
 *
 * De transform komt uit `motionStyleAt()`, dezelfde functie die de
 * `zoompan`-expressie voor FFmpeg oplevert. Dit is dus geen indruk van de
 * beweging, het is de beweging.
 */

export type PreviewStageProps = {
  document: EditorDocument;
  segment: TimelineSegment | null;
  /** Hoever de scène staat, van 0 tot 1. */
  progress: number;
  className?: string;
};

export function PreviewStage({ document, segment, progress, className }: PreviewStageProps) {
  const brand = resolveBrand(document.brand, document.branding);
  const scene = segment?.kind === "scene" ? findScene(document, segment.sceneId) : null;

  return (
    <div
      className={cn(
        // `@container` maakt de `cqw`-maten hieronder mogelijk: de tekst in de
        // preview schaalt mee met het kader, net als in de echte render.
        "@container relative isolate max-h-full max-w-full overflow-hidden rounded-xl border border-border bg-black shadow-elevated",
        className,
      )}
      style={{ aspectRatio: aspectRatioCss(document.aspectRatio) }}
    >
      {segment?.kind === "intro" ? (
        <div
          className="flex size-full flex-col items-center justify-center gap-2 p-[8%] text-center"
          style={{
            backgroundColor: brand.primaryColor,
            color: brand.onPrimaryColor,
            fontFamily: brand.fontStack,
          }}
        >
          <p className="text-[clamp(1rem,4cqw,2rem)] leading-tight font-semibold text-balance">
            {document.title || "Naamloos project"}
          </p>
          <p className="text-[clamp(0.625rem,2cqw,0.875rem)] opacity-80">
            {brand.contact.agentName || "Immoreel"}
          </p>
        </div>
      ) : null}

      {/* Dezelfde eindkaart als op de instellingenpagina en in de speler. */}
      {segment?.kind === "outro" ? (
        <EndCardPreview
          brand={brand}
          aspectRatio={document.aspectRatio}
          className="size-full rounded-none border-0 shadow-none"
        />
      ) : null}

      {scene ? (
        <>
          {scene.source.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={scene.source.previewUrl}
              alt=""
              draggable={false}
              className="size-full object-cover will-change-transform"
              style={motionStyleAt(scene.motion, progress)}
            />
          ) : (
            <div
              className="flex size-full flex-col items-center justify-center gap-2 bg-surface-inset text-fg-subtle"
              style={motionStyleAt(scene.motion, progress)}
            >
              <ImageOff aria-hidden="true" className="size-6" />
              <p className="max-w-[80%] truncate text-xs">{scene.source.fileName}</p>
            </div>
          )}

          {scene.captionTop ? (
            <p className="absolute top-[6%] right-[6%] left-[6%] text-center text-[clamp(0.625rem,2.5cqw,1.125rem)] font-semibold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
              {scene.captionTop}
            </p>
          ) : null}

          {scene.captionBottom ? (
            <p className="absolute right-[6%] bottom-[6%] left-[6%] text-center text-[clamp(0.5625rem,2cqw,1rem)] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
              {scene.captionBottom}
            </p>
          ) : null}

          {document.branding.showPriceBadge && scene.order === 0 ? (
            <span
              className="absolute top-[6%] left-[6%] rounded-md px-2 py-1 text-[clamp(0.5rem,1.8cqw,0.875rem)] font-semibold"
              style={{ backgroundColor: brand.primaryColor, color: brand.onPrimaryColor }}
            >
              Prijs op aanvraag
            </span>
          ) : null}
        </>
      ) : null}

      {!segment ? (
        <div className="flex size-full items-center justify-center p-6 text-center text-xs text-fg-subtle">
          Voeg foto&apos;s toe om een preview te zien.
        </div>
      ) : null}

      {/* Het watermerk ligt over elk beeld, ook over de titelkaarten. */}
      {brand.showWatermark && document.branding.logoPlacement !== "geen" ? (
        <span
          className={cn(
            "absolute flex aspect-square w-[9%] min-w-6 items-center justify-center",
            "drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]",
            logoPlacementClassName(document.branding.logoPlacement),
          )}
        >
          <BrandMark
            brand={brand}
            className="size-full max-h-full max-w-full text-[clamp(0.4375rem,2.6cqw,0.875rem)]"
          />
        </span>
      ) : null}
    </div>
  );
}
