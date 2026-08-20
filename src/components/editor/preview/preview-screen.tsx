"use client";

import { ImageOff } from "lucide-react";
import { BrandMark, EndCardPreview } from "@/components/brand/end-card-preview";
import { motionStyleAt } from "@/lib/editor/motion";
import {
  transitionStyleAt,
  type PreviewFrame,
  type PreviewLayerStyle,
  type PreviewPlan,
  type PreviewSlide,
} from "@/lib/editor/preview-plan";
import type { PreviewProxy } from "@/lib/editor/preview-proxy";
import { logoPlacementClassName } from "@/lib/editor/branding";
import { aspectRatioCss } from "@/lib/aspect-ratios";
import { cn } from "@/lib/utils";

/**
 * Het beeld van de previewspeler.
 *
 * Twee lagen boven elkaar: wat er wegloopt en wat eroverheen komt. Dat tweede
 * is het verschil met de preview in de editor — daar staat altijd één scène in
 * beeld, hier zie je de overgang zelf. Precies daar zit het gevoel van een
 * video: of een crossfade rustig aanvoelt bij scènes van twee seconden is
 * alleen te beoordelen door hem te zien gebeuren.
 *
 * Alles komt uit het plan en uit de meegegeven foto's. Deze component kijkt
 * niet naar het document en zoekt niets op: wat hier staat is wat er op het
 * moment van opbouwen vastgelegd is.
 */

export type PreviewScreenProps = {
  plan: PreviewPlan;
  /** De verkleinde foto's, op bron-URL. */
  photos: Map<string, PreviewProxy>;
  frame: PreviewFrame;
  className?: string;
};

export function PreviewScreen({ plan, photos, frame, className }: PreviewScreenProps) {
  const transition = frame.slide
    ? transitionStyleAt(frame.slide.transition, frame.transitionProgress)
    : null;

  return (
    <div
      className={cn(
        // `@container` maakt de `cqw`-maten hieronder mogelijk: de tekst
        // schaalt mee met het kader, net als in de echte render.
        "@container relative isolate max-h-full max-w-full overflow-hidden rounded-xl bg-black shadow-elevated",
        className,
      )}
      style={{ aspectRatio: aspectRatioCss(plan.aspectRatio) }}
    >
      {frame.outgoing && transition ? (
        <PreviewLayer
          plan={plan}
          photos={photos}
          slide={frame.outgoing}
          progress={frame.outgoingProgress}
          layer={transition.outgoing}
        />
      ) : null}

      {frame.slide ? (
        <PreviewLayer
          plan={plan}
          photos={photos}
          slide={frame.slide}
          progress={frame.progress}
          layer={transition?.incoming ?? FULLY_VISIBLE}
        />
      ) : (
        <p className="flex size-full items-center justify-center p-6 text-center text-xs text-white/60">
          Voeg foto&apos;s toe om een preview te zien.
        </p>
      )}

      {/* Het watermerk ligt over elk beeld, ook over de titelkaarten en de
          overgang. Staat het uit in de huisstijl, dan heeft het plan de plaats
          al op "geen" gezet. */}
      {plan.slides.length > 0 && plan.branding.logoPlacement !== "geen" ? (
        <span
          className={cn(
            "absolute flex aspect-square w-[9%] min-w-6 items-center justify-center",
            "drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]",
            logoPlacementClassName(plan.branding.logoPlacement),
          )}
        >
          <BrandMark
            brand={plan.branding.brand}
            className="size-full max-h-full max-w-full text-[clamp(0.4375rem,2.6cqw,0.875rem)]"
          />
        </span>
      ) : null}
    </div>
  );
}

const FULLY_VISIBLE: PreviewLayerStyle = { opacity: 1, translateX: 0 };

type PreviewLayerProps = {
  plan: PreviewPlan;
  photos: Map<string, PreviewProxy>;
  slide: PreviewSlide;
  progress: number;
  layer: PreviewLayerStyle;
};

function PreviewLayer({ plan, photos, slide, progress, layer }: PreviewLayerProps) {
  const { branding } = plan;
  const { brand } = branding;
  const cardStyle = {
    backgroundColor: brand.primaryColor,
    color: brand.onPrimaryColor,
    fontFamily: brand.fontStack,
  };
  const photo = slide.photo ? photos.get(slide.photo.url) : null;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        opacity: layer.opacity,
        transform: layer.translateX === 0 ? undefined : `translateX(${(layer.translateX * 100).toFixed(3)}%)`,
      }}
    >
      {slide.kind === "intro" ? (
        <div
          className="flex size-full flex-col items-center justify-center gap-2 p-[8%] text-center"
          style={cardStyle}
        >
          <p className="text-[clamp(1rem,4cqw,2rem)] leading-tight font-semibold text-balance">
            {branding.title || "Naamloos project"}
          </p>
          <p className="text-[clamp(0.625rem,2cqw,0.875rem)] opacity-80">
            {brand.contact.agentName || "Immoreel"}
          </p>
        </div>
      ) : null}

      {/* Precies dezelfde kaart als op de instellingenpagina: één component,
          dus geen tweede plek waar de eindkaart anders kan gaan werken. */}
      {slide.kind === "outro" ? (
        <EndCardPreview
          brand={brand}
          aspectRatio={plan.aspectRatio}
          className="size-full rounded-none border-0 shadow-none"
        />
      ) : null}

      {slide.kind === "scene" ? (
        <>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt=""
              draggable={false}
              width={photo.width}
              height={photo.height}
              className="size-full object-cover will-change-transform"
              style={motionStyleAt(slide.motion, progress)}
            />
          ) : (
            <div
              className="flex size-full flex-col items-center justify-center gap-2 bg-neutral-900 text-white/50"
              style={motionStyleAt(slide.motion, progress)}
            >
              <ImageOff aria-hidden="true" className="size-6" />
              <p className="max-w-[80%] truncate text-xs">
                {slide.photo?.fileName ?? "Nog geen foto"}
              </p>
            </div>
          )}

          {slide.captionTop ? (
            <p className="absolute top-[6%] right-[6%] left-[6%] text-center text-[clamp(0.625rem,2.5cqw,1.125rem)] font-semibold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
              {slide.captionTop}
            </p>
          ) : null}

          {slide.captionBottom ? (
            <p className="absolute right-[6%] bottom-[6%] left-[6%] text-center text-[clamp(0.5625rem,2cqw,1rem)] text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
              {slide.captionBottom}
            </p>
          ) : null}

          {slide.showPriceBadge ? (
            <span
              className="absolute top-[6%] left-[6%] rounded-md px-2 py-1 text-[clamp(0.5rem,1.8cqw,0.875rem)] font-semibold"
              style={cardStyle}
            >
              Prijs op aanvraag
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
