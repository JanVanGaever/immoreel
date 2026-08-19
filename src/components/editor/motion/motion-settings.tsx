"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { MotionControls } from "@/components/editor/motion/motion-controls";
import { MotionMiniPreview } from "@/components/editor/motion/motion-mini-preview";
import { MotionPresetGrid } from "@/components/editor/motion/motion-preset-grid";
import { Badge } from "@/components/ui/badge";
import { matchMotionPreset, toZoompanFilter } from "@/lib/editor/motion";
import { cn } from "@/lib/utils";
import type { AspectRatio, MotionKind, SceneMotion } from "@/types";

/**
 * De motionmodule van één foto: preset kiezen, zien wat het doet, en zo nodig
 * zelf afstellen.
 *
 * Alles wat hier binnenkomt zijn losse waarden, geen editorcontroller. Daardoor
 * is dezelfde module bruikbaar op een scène, op een selectie van foto's, en
 * straks op een sjabloon of in de mediabibliotheek.
 *
 * De volgorde is die van het gebruik: eerst zien, dan kiezen, dan pas
 * bijstellen. Het fijnregelen staat achter één klik omdat de tien presets voor
 * de meeste panden volstaan — maar wie zelf wil afstellen, hoeft er niet om te
 * bedelen.
 */

export type MotionSettingsProps = {
  motion: SceneMotion;
  onChange: (changes: Partial<SceneMotion>) => void;
  durationInSeconds: number;
  /** De foto van deze scène, voor de mini-preview. */
  previewUrl?: string | null;
  aspectRatio?: AspectRatio;
  /** Bewegingen die het gekozen template afraadt. */
  discouraged?: MotionKind[];
  /** Bijvoorbeeld: op hoeveel foto's een wijziging slaat. */
  hint?: string;
  /** Waarmee de renderinstructie berekend wordt; alleen ter illustratie. */
  fps?: number;
  size?: string;
  className?: string;
};

export function MotionSettings({
  motion,
  onChange,
  durationInSeconds,
  previewUrl,
  aspectRatio = "16:9",
  discouraged,
  hint,
  fps = 30,
  size = "1920x1080",
  className,
}: MotionSettingsProps) {
  const preset = matchMotionPreset(motion);
  // Een eigen afstelling staat meteen open: die heeft de gebruiker zelf gemaakt.
  const [isTuning, setTuning] = useState(preset === null);

  return (
    <div className={cn("space-y-3", className)}>
      <MotionMiniPreview
        motion={motion}
        durationInSeconds={durationInSeconds}
        previewUrl={previewUrl}
        aspectRatio={aspectRatio}
      />

      <MotionPresetGrid motion={motion} onSelect={onChange} discouraged={discouraged} />

      <p className="flex items-start gap-1.5 text-[0.6875rem] leading-relaxed text-fg-muted">
        {preset ? (
          preset.description
        ) : (
          <>
            <Badge size="sm" variant="brand">
              Aangepast
            </Badge>
            <span>Eigen afstelling; kies een preset om terug te gaan.</span>
          </>
        )}
      </p>

      <div className="rounded-md border border-border bg-surface">
        <button
          type="button"
          onClick={() => setTuning((current) => !current)}
          aria-expanded={isTuning}
          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-[0.6875rem] font-medium text-fg-muted hover:text-fg"
        >
          <SlidersHorizontal aria-hidden="true" className="size-3.5" />
          Zelf afstellen
          <ChevronDown
            aria-hidden="true"
            className={cn("ml-auto size-3.5 transition-transform", isTuning && "rotate-180")}
          />
        </button>

        {isTuning ? (
          <div className="border-t border-border p-2">
            <MotionControls
              motion={motion}
              onChange={onChange}
              durationInSeconds={durationInSeconds}
            />
          </div>
        ) : null}
      </div>

      {hint ? <p className="text-[0.6875rem] text-fg-subtle">{hint}</p> : null}

      <details className="text-[0.6875rem] text-fg-muted">
        <summary className="cursor-pointer text-fg-subtle select-none">Renderinstructie</summary>
        {/* Wat de renderworker straks letterlijk uitvoert. Het staat hier omdat
            het de controle is op de preview hierboven: dezelfde getallen, en
            dezelfde volgorde van tempo, versnelling en interpolatie. */}
        <code className="mt-2 block break-all rounded-md bg-surface-inset p-2 font-mono text-[0.625rem] leading-relaxed">
          {toZoompanFilter(motion, { durationInSeconds, fps, size }).filter}
        </code>
      </details>
    </div>
  );
}
