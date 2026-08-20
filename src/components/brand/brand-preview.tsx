"use client";

import { useState } from "react";
import { EndCardPreview } from "@/components/brand/end-card-preview";
import { WatermarkPreview } from "@/components/brand/watermark-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AspectRatio, LogoPlacement, ResolvedBrand } from "@/types";

/**
 * De preview naast het formulier: de eindkaart, en het watermerk over een
 * scène.
 *
 * Twee tabbladen en geen twee kaders onder elkaar, want de vraag is telkens
 * een andere. "Klopt mijn slotkaart?" beantwoord je door ernaar te kijken;
 * "blijft mijn logo leesbaar op een foto?" ook — maar niet tegelijk.
 *
 * De beeldverhouding staat erbij omdat een eindkaart die in 16:9 werkt, in
 * 9:16 een heel andere kaart is: dezelfde tekst, half zoveel breedte.
 */

export type BrandPreviewProps = {
  brand: ResolvedBrand;
  /** Waar het watermerk staat; per project in te stellen, hier ter illustratie. */
  watermarkPlacement?: LogoPlacement;
  className?: string;
};

const RATIOS: { id: AspectRatio; label: string }[] = [
  { id: "9:16", label: "9:16" },
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
];

export function BrandPreview({
  brand,
  watermarkPlacement = "rechtsonder",
  className,
}: BrandPreviewProps) {
  const [ratio, setRatio] = useState<AspectRatio>("9:16");

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Tabs defaultValue="eindkaart" variant="pill">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="eindkaart">Eindkaart</TabsTrigger>
            <TabsTrigger value="watermerk">Watermerk</TabsTrigger>
          </TabsList>

          <div
            role="group"
            aria-label="Beeldverhouding van de preview"
            className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5"
          >
            {RATIOS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRatio(option.id)}
                aria-pressed={ratio === option.id}
                className={cn(
                  "rounded-sm px-2 py-1 text-[0.6875rem] font-medium tabular-nums transition-colors duration-150",
                  ratio === option.id
                    ? "bg-brand-soft text-brand"
                    : "text-fg-muted hover:text-fg",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <TabsContent value="eindkaart" className="mt-4">
          <div className="flex justify-center">
            <EndCardPreview
              brand={brand}
              aspectRatio={ratio}
              className="max-h-[62vh] w-full max-w-sm"
            />
          </div>
          <p className="mt-3 text-xs text-fg-subtle">
            Deze kaart komt achter elke video, zolang de slotkaart in het project aanstaat.
          </p>
        </TabsContent>

        <TabsContent value="watermerk" className="mt-4">
          <div className="flex justify-center">
            <WatermarkPreview
              brand={brand}
              aspectRatio={ratio}
              placement={watermarkPlacement}
              className="max-h-[62vh] w-full max-w-sm"
            />
          </div>
          <p className="mt-3 text-xs text-fg-subtle">
            {brand.showWatermark
              ? "Het watermerk staat standaard aan. In welke hoek het komt, kies je per project."
              : "Het watermerk staat standaard uit. Per project kan je het alsnog aanzetten."}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
