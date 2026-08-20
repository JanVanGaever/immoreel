"use client";

import { contactLines } from "@/lib/brand/kit";
import { aspectRatioCss } from "@/lib/aspect-ratios";
import { cn } from "@/lib/utils";
import type { AspectRatio, ResolvedBrand } from "@/types";

/**
 * De eindkaart zoals ze gerenderd wordt.
 *
 * Dit is de kaart die achter elke video komt: het logo, de vraag, de oproep en
 * hoe je het kantoor bereikt. Er wordt niets voorbereid — elke wijziging in
 * het formulier is meteen hier te zien, want dit component leest gewoon af wat
 * `resolveBrand()` oplevert.
 *
 * De maten staan in `cqw` (procent van de containerbreedte) en niet in pixels.
 * Daardoor klopt de verhouding tussen tekst en kader in elk formaat, net als
 * in de echte render — waar `cardFontSize()` hetzelfde doet, maar dan ten
 * opzichte van de exportresolutie.
 */

export type EndCardPreviewProps = {
  brand: ResolvedBrand;
  aspectRatio: AspectRatio;
  className?: string;
};

export function EndCardPreview({ brand, aspectRatio, className }: EndCardPreviewProps) {
  const lines = contactLines(brand);
  const outro = brand.outroText.trim();
  const cta = brand.ctaText.trim();
  const name = brand.contact.agentName.trim();

  return (
    <div
      className={cn(
        // `@container` maakt de `cqw`-maten hieronder mogelijk; zonder dit
        // schaalt de tekst niet mee met het kader.
        "@container relative isolate overflow-hidden rounded-xl border border-border shadow-elevated",
        className,
      )}
      style={{
        aspectRatio: aspectRatioCss(aspectRatio),
        backgroundColor: brand.primaryColor,
        color: brand.onPrimaryColor,
        fontFamily: brand.fontStack,
      }}
    >
      {/* Een zweem van de secundaire kleur achter de kaart: genoeg om de twee
          kleuren samen te zien werken, niet genoeg om de tekst te storen. */}
      <span
        aria-hidden="true"
        className="absolute -top-[30%] -right-[20%] size-[70%] rounded-full opacity-20 blur-2xl"
        style={{ backgroundColor: brand.secondaryColor }}
      />

      <div className="relative flex size-full flex-col items-center justify-center gap-[3cqw] p-[9%] text-center">
        <BrandMark brand={brand} />

        {outro ? (
          <p className="max-w-[86%] text-[clamp(0.75rem,5cqw,2.25rem)] leading-tight font-semibold text-balance">
            {outro}
          </p>
        ) : null}

        {cta ? (
          <p
            className="rounded-full px-[4cqw] py-[1.6cqw] text-[clamp(0.5rem,3cqw,1.25rem)] leading-none font-semibold"
            style={{ backgroundColor: brand.secondaryColor, color: brand.onSecondaryColor }}
          >
            {cta}
          </p>
        ) : null}

        {name || lines.length > 0 ? (
          <div className="mt-[1cqw] flex flex-col items-center gap-[0.8cqw]">
            {name ? (
              <p className="text-[clamp(0.5rem,3.2cqw,1.375rem)] leading-tight font-semibold">
                {name}
              </p>
            ) : null}
            {lines.map((line) => (
              <p
                key={line}
                className="text-[clamp(0.4375rem,2.4cqw,1rem)] leading-tight opacity-85 tabular-nums"
              >
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {!outro && !cta && !name && lines.length === 0 ? (
          <p className="text-[clamp(0.5rem,2.6cqw,1rem)] opacity-60">
            Vul hiernaast iets in en de kaart vult zich mee.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Het logo, of de initialen zolang er geen bestand is. Bewust dezelfde
 * afweging als in het watermerk: liever twee letters in de huisstijl dan een
 * lege plek waarvan niemand weet of er iets hoort te staan.
 */
export function BrandMark({
  brand,
  className,
}: {
  brand: ResolvedBrand;
  className?: string;
}) {
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logoUrl}
        alt=""
        className={cn("max-h-[18cqw] max-w-[55%] object-contain", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-[14cqw] items-center justify-center rounded-lg text-[clamp(0.5rem,5cqw,2rem)] leading-none font-bold",
        className,
      )}
      style={{ backgroundColor: brand.secondaryColor, color: brand.onSecondaryColor }}
    >
      {brand.logoInitials}
    </span>
  );
}
