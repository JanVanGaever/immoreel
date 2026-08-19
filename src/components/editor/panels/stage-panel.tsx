"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat, Square } from "lucide-react";
import { PreviewStage } from "@/components/editor/panels/preview-stage";
import { Timeline } from "@/components/editor/panels/timeline";
import type { EditorController } from "@/components/editor/use-editor";
import { usePlayback } from "@/components/editor/use-playback";
import { Button, IconButton } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { sceneAt } from "@/lib/editor/document";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Het midden van de editor: de preview, de knoppen eronder en de tijdlijn.
 *
 * De afspeelkop woont hier en niet in `useEditor`. Dat is met opzet: hij
 * beweegt zestig keer per seconde, en alleen dit stuk van het scherm hoeft
 * daarop te reageren. De panelen links en rechts hertekenen dus niet mee.
 *
 * "Herhalen" speelt de scène waar je aan werkt in een lus. Wie aan de
 * beweging van één foto zit, wil die zien lopen zonder telkens op play te
 * duwen — en met een preview die stilstaat is een instelling als "subtiel of
 * sterk" niet te beoordelen.
 */
export function StagePanel({ editor, className }: { editor: EditorController; className?: string }) {
  const [autoPreview, setAutoPreview] = useState(true);
  const playback = usePlayback(editor.durationInSeconds);
  const { segment, progress } = sceneAt(editor.timeline, playback.time);

  const activeSceneId = editor.state.activeSceneId;
  const activeSegment =
    editor.timeline.segments.find((item) => item.sceneId === activeSceneId) ?? null;
  const activeIndex = editor.scenes.findIndex((scene) => scene.id === activeSceneId);

  const { seek, playRange } = playback;

  // Een andere scène kiezen zet de kop aan het begin van die scène.
  const lastSceneRef = useRef(activeSceneId);
  useEffect(() => {
    if (lastSceneRef.current === activeSceneId) return;

    lastSceneRef.current = activeSceneId;
    if (activeSegment) seek(activeSegment.startInSeconds);
  }, [activeSceneId, activeSegment, seek]);

  // De beweging of de duur wijzigen: meteen tonen wat dat doet.
  const motionKey = editor.activeScene
    ? `${JSON.stringify(editor.activeScene.motion)}:${editor.activeScene.durationInSeconds}`
    : "";
  const lastMotionRef = useRef(motionKey);
  useEffect(() => {
    if (lastMotionRef.current === motionKey) return;

    lastMotionRef.current = motionKey;
    if (!autoPreview || !activeSegment) return;

    playRange({
      from: activeSegment.startInSeconds,
      to: activeSegment.startInSeconds + activeSegment.durationInSeconds,
    });
  }, [motionKey, autoPreview, activeSegment, playRange]);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      <div className="surface-grid flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
        <PreviewStage
          document={editor.document}
          segment={segment}
          progress={progress}
          // Staand beeld wordt door de hoogte begrensd, liggend door de
          // breedte; anders duwt een 9:16-kader de tijdlijn van het scherm.
          className={
            editor.document.aspectRatio === "16:9" ? "max-h-full w-full max-w-3xl" : "h-full"
          }
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-surface px-3 py-2">
        <IconButton
          label={playback.isPlaying ? "Pauzeren" : "Afspelen"}
          variant="secondary"
          size="icon-sm"
          onClick={playback.toggle}
        >
          {playback.isPlaying ? <Pause /> : <Play />}
        </IconButton>
        <IconButton label="Naar het begin" variant="ghost" size="icon-sm" onClick={playback.stop}>
          <Square />
        </IconButton>

        <Button
          variant={playback.range ? "primary" : "ghost"}
          size="sm"
          disabled={!activeSegment}
          onClick={() =>
            activeSegment &&
            playRange({
              from: activeSegment.startInSeconds,
              to: activeSegment.startInSeconds + activeSegment.durationInSeconds,
            })
          }
        >
          <Repeat />
          Scène herhalen
        </Button>

        <span className="text-xs text-fg-muted tabular-nums">
          {formatDuration(playback.time)} / {formatDuration(editor.durationInSeconds)}
        </span>

        {activeIndex >= 0 ? (
          <span className="hidden text-xs text-fg-subtle sm:inline">
            Scène {activeIndex + 1} van {editor.scenes.length}
          </span>
        ) : null}

        <Switch
          className="ml-auto"
          checked={autoPreview}
          onCheckedChange={setAutoPreview}
          label={<span className="text-xs text-fg-muted">Auto-preview</span>}
        />
      </div>

      <Timeline
        timeline={editor.timeline}
        activeSceneId={activeSceneId}
        selectedSceneIds={editor.state.selectedSceneIds}
        time={playback.time}
        onSelectScene={(sceneId) => editor.selectScene(sceneId)}
        onSeek={playback.seek}
        className="shrink-0"
      />
    </div>
  );
}
