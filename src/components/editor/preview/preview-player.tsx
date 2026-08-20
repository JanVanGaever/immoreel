"use client";

import { Info, Loader2 } from "lucide-react";
import { PreviewControls } from "@/components/editor/preview/preview-controls";
import { PreviewScreen } from "@/components/editor/preview/preview-screen";
import { PreviewSlides } from "@/components/editor/preview/preview-slides";
import { usePreviewPlan } from "@/components/editor/preview/use-preview-plan";
import { usePreviewPlayback } from "@/components/editor/preview/use-preview-playback";
import { usePrefersReducedMotion } from "@/components/editor/motion/use-motion-loop";
import type { EditorDocument } from "@/lib/editor/document";
import { previewFrameAt, type PreviewPlan } from "@/lib/editor/preview-plan";
import type { PreviewProxy } from "@/lib/editor/preview-proxy";
import { cn } from "@/lib/utils";

/**
 * De previewspeler: hoe de video ongeveer aanvoelt, vóór het renderen.
 *
 * Het woord is "ongeveer" en dat is geen tekortkoming maar het punt. De echte
 * render duurt minuten en levert een bestand op; deze speler antwoordt in een
 * paar honderd milliseconden op de enige vraag die je vóór dat wachten hebt:
 * blijft dit boeien, staan de beelden lang genoeg, is die overgang niet te
 * druk? Daarvoor hoeft het beeld niet scherp te zijn — het moet kloppen in
 * tijd, volgorde en beweging, en dat doet het: dezelfde tijdlijn en dezelfde
 * bewegingsfuncties als het renderplan.
 *
 * De speler bestaat uit twee lagen, en die scheiding is de kern van hoe hij
 * met wijzigingen omgaat:
 *
 * - `PreviewPlayer` houdt het plan bij en de verkleinde foto's. Die overleven
 *   een wijziging, want dezelfde foto twee keer verkleinen is verspilling.
 * - `PreviewRun` speelt één plan af. Komt er een nieuw plan, dan krijgt hij een
 *   nieuwe `key` en begint hij vanzelf opnieuw — vooraan, zonder dat er ergens
 *   een afspeelkop teruggezet moet worden.
 */

export type PreviewPlayerProps = {
  document: EditorDocument;
  className?: string;
};

export function PreviewPlayer({ document, className }: PreviewPlayerProps) {
  const { plan, photos, revision, isPreparing, isBuilding, progress } = usePreviewPlan(document);

  return (
    <PreviewRun
      key={revision}
      plan={plan}
      photos={photos}
      isPreparing={isPreparing}
      isBuilding={isBuilding}
      progress={progress}
      className={className}
    />
  );
}

type PreviewRunProps = {
  plan: PreviewPlan;
  photos: Map<string, PreviewProxy>;
  isPreparing: boolean;
  isBuilding: boolean;
  progress: number;
  className?: string;
};

function PreviewRun({
  plan,
  photos,
  isPreparing,
  isBuilding,
  progress,
  className,
}: PreviewRunProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const playback = usePreviewPlayback({
    durationInSeconds: plan.durationInSeconds,
    // Tijdens het opbouwen staat de kop stil; "afspelen" gaat niet uit.
    canPlay: !isPreparing,
    // Wie liever geen bewegende beelden krijgt, drukt zelf op afspelen.
    autoPlay: !prefersReducedMotion,
  });

  const frame = previewFrameAt(plan, playback.time);
  const isEmpty = plan.slides.length === 0;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* De hoogte komt van buiten: in het editorpaneel vult de speler wat er
          is, in een venster krijgt hij een vaste maat mee. */}
      <div className="surface-grid relative flex min-h-0 flex-1 items-center justify-center p-3">
        <PreviewScreen
          plan={plan}
          photos={photos}
          frame={frame}
          // Staand beeld wordt door de hoogte begrensd, liggend door de
          // breedte; anders duwt een 9:16-kader de bediening weg.
          className={plan.aspectRatio === "16:9" ? "max-h-full w-full max-w-3xl" : "h-full"}
        />

        {isPreparing && !isEmpty ? (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-canvas/75 backdrop-blur-[2px]"
          >
            <Loader2 aria-hidden="true" className="size-5 animate-spin text-brand" />
            <p className="text-xs font-medium text-fg">
              {isBuilding ? "Foto's voorbereiden…" : "Preview bijwerken…"}
            </p>

            {isBuilding && plan.photoUrls.length > 1 ? (
              <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-inset">
                <span
                  className="block h-full origin-left rounded-full bg-brand transition-transform duration-200"
                  style={{ transform: `scaleX(${progress.toFixed(3)})` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isEmpty ? null : (
        <>
          <PreviewControls
            plan={plan}
            playback={playback}
            activeIndex={frame.index}
            className="border-t border-border bg-surface"
          />

          <PreviewSlides
            plan={plan}
            activeIndex={frame.index}
            progress={frame.progress}
            onSelect={playback.seek}
            className="border-t border-border bg-surface"
          />

          <p className="flex items-start gap-1.5 border-t border-border bg-surface-subtle px-3 py-2 text-[0.6875rem] leading-relaxed text-fg-subtle">
            <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            <span>
              Benadering op {plan.size.width}×{plan.size.height} zonder geluid. Tijdlijn, duur en
              beweging zijn dezelfde als bij het renderen; scherpte en overgangen worden in de
              export beter.
              {plan.missingPhotos > 0
                ? ` ${plan.missingPhotos} foto's zijn nog niet klaar met uploaden.`
                : ""}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
