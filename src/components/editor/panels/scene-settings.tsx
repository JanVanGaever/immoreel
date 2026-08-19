"use client";

import { DurationSlider } from "@/components/editor/panels/duration-field";
import { MotionSettings } from "@/components/editor/motion/motion-settings";
import { PanelSection } from "@/components/editor/panel";
import type { EditorController } from "@/components/editor/use-editor";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TRANSITION_OPTIONS, type TransitionId } from "@/lib/editor/templates";
import { formatSeconds } from "@/lib/format";

/**
 * De instellingen van de scène die open staat — of van alles wat aangevinkt
 * is. Dat onderscheid staat bovenaan in beeld, want een regelaar die er
 * hetzelfde uitziet maar twaalf foto's tegelijk wijzigt, hoort dat te zeggen.
 */
export function SceneSettings({ editor }: { editor: EditorController }) {
  const scene = editor.activeScene;
  const count = editor.targetIds.length;

  if (!scene) {
    return (
      <p className="p-4 text-xs text-fg-muted">
        Kies links een foto om haar duur, beweging en bijschriften in te stellen.
      </p>
    );
  }

  const transition = (scene.transition as TransitionId | null) ?? "crossfade";
  const bulkHint = editor.isBulk ? `Geldt voor ${count} geselecteerde foto's.` : undefined;

  return (
    <>
      <PanelSection
        title={editor.isBulk ? `${count} foto's` : scene.source.fileName}
        aside={
          editor.isBulk ? (
            <Badge size="sm" variant="brand">
              bulk
            </Badge>
          ) : (
            <span className="text-xs text-fg-subtle tabular-nums">
              {formatSeconds(scene.durationInSeconds)}
            </span>
          )
        }
      >
        <DurationSlider
          seconds={scene.durationInSeconds}
          onChange={(seconds) => editor.setDuration(seconds)}
          hint={bulkHint}
        />
      </PanelSection>

      <PanelSection title="Beweging">
        <MotionSettings
          motion={scene.motion}
          onChange={(changes) => editor.updateMotion(changes)}
          durationInSeconds={scene.durationInSeconds}
          previewUrl={scene.source.previewUrl}
          aspectRatio={editor.document.aspectRatio}
          discouraged={editor.style.discouragedMotion}
          hint={bulkHint}
        />
      </PanelSection>

      <PanelSection title="Overgang" description="Hoe deze scène in de volgende overgaat.">
        <Select
          selectSize="sm"
          value={transition}
          onChange={(event) => editor.setTransition(event.target.value as TransitionId, editor.targetIds)}
          aria-label="Overgang"
        >
          {TRANSITION_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </PanelSection>

      {!editor.isBulk ? (
        <PanelSection
          title="Bijschriften"
          description="Blijven de hele scène in beeld. Hou ze kort: op een telefoon leest niemand twee regels."
        >
          <div className="space-y-2">
            <Input
              inputSize="sm"
              placeholder="Boven in beeld"
              aria-label="Bijschrift boven"
              value={scene.captionTop ?? ""}
              onChange={(event) => editor.setCaption(scene.id, "boven", event.target.value)}
            />
            <Input
              inputSize="sm"
              placeholder="Onder in beeld"
              aria-label="Bijschrift onder"
              value={scene.captionBottom ?? ""}
              onChange={(event) => editor.setCaption(scene.id, "onder", event.target.value)}
            />
          </div>
        </PanelSection>
      ) : null}

    </>
  );
}
