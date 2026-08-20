"use client";

import { memo, useCallback, type MouseEvent } from "react";
import { Layers } from "lucide-react";
import type { Timeline as TimelineModel, TimelineSegment } from "@/lib/editor/document";
import { formatDuration, formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ID } from "@/types";

/**
 * De tijdlijn onder de preview: intro, elke scène, en de slotkaart als de
 * huisstijl er een vraagt.
 *
 * De blokken staan op schaal, dus een scène van vijf seconden ís hier vijf keer
 * zo breed als een van één. Dat is de enige plek waar de verhouding tussen de
 * scènes in één oogopslag klopt.
 *
 * Die schaal heeft één ondergrens nodig. Twintig scènes op een telefoon van
 * 375 pixels maakt blokken van zestien pixels breed: niet te lezen en niet aan
 * te tikken. De baan krijgt daarom een minimumbreedte die met het aantal
 * scènes meegroeit en schuift horizontaal zodra ze niet meer past. De
 * verhoudingen blijven kloppen — ze staan alleen op een bredere baan.
 *
 * De blokken zitten in een gememoiseerde component: de afspeelkop beweegt
 * zestig keer per seconde, en dan hoeven veertig blokken niet mee te
 * hertekenen.
 */

/** Onder deze breedte is een blok niet meer te lezen of aan te tikken. */
const MIN_SEGMENT_WIDTH_PX = 44;

export type TimelineProps = {
  timeline: TimelineModel;
  activeSceneId: ID | null;
  selectedSceneIds: ID[];
  time: number;
  onSelectScene: (sceneId: ID) => void;
  onSeek: (time: number) => void;
  className?: string;
};

export function Timeline({
  timeline,
  activeSceneId,
  selectedSceneIds,
  time,
  onSelectScene,
  onSeek,
  className,
}: TimelineProps) {
  const duration = Math.max(timeline.durationInSeconds, 0.001);

  const handleTrackClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - bounds.left) / bounds.width;

      onSeek(Math.min(Math.max(ratio, 0), 1) * duration);
    },
    [duration, onSeek],
  );

  return (
    <div className={cn("flex flex-col gap-2 border-t border-border bg-surface p-3", className)}>
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wider text-fg-subtle uppercase">
          <Layers aria-hidden="true" className="size-3.5" />
          Tijdlijn
        </p>
        <span className="ml-auto text-xs text-fg-muted tabular-nums">
          {formatDuration(time)} / {formatDuration(timeline.durationInSeconds)}
        </span>
      </div>

      {/* De baan schuift binnen deze strook; de klik om te verspringen zit op
          de baan zelf, zodat een verschoven strook de positie niet verlegt. */}
      <div className="scroll-x rounded-lg bg-surface-inset">
        <div
          onClick={handleTrackClick}
          style={{ minWidth: `${timeline.segments.length * MIN_SEGMENT_WIDTH_PX}px` }}
          className="relative h-16 w-full cursor-crosshair overflow-hidden rounded-lg"
        >
          <TimelineTrack
            segments={timeline.segments}
            duration={duration}
            activeSceneId={activeSceneId}
            selectedSceneIds={selectedSceneIds}
            onSelectScene={onSelectScene}
          />

          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-brand"
            style={{ left: `${Math.min((time / duration) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type TimelineTrackProps = {
  segments: TimelineSegment[];
  duration: number;
  activeSceneId: ID | null;
  selectedSceneIds: ID[];
  onSelectScene: (sceneId: ID) => void;
};

const TimelineTrack = memo(function TimelineTrack({
  segments,
  duration,
  activeSceneId,
  selectedSceneIds,
  onSelectScene,
}: TimelineTrackProps) {
  return (
    <ol aria-label="Blokken in de tijdlijn" className="absolute inset-0">
      {segments.map((segment) => {
        const isScene = segment.kind === "scene";
        const isActive = isScene && segment.sceneId === activeSceneId;
        const isSelected = isScene && segment.sceneId !== null && selectedSceneIds.includes(segment.sceneId);

        return (
          <li
            key={segment.id}
            className="absolute inset-y-0 p-0.5"
            style={{
              left: `${(segment.startInSeconds / duration) * 100}%`,
              width: `${(segment.durationInSeconds / duration) * 100}%`,
            }}
          >
            <button
              type="button"
              disabled={!isScene}
              onClick={(event) => {
                // Anders zou de klik ook op de balk landen en de kop verzetten.
                event.stopPropagation();
                if (segment.sceneId) onSelectScene(segment.sceneId);
              }}
              title={`${segment.label} · ${formatSeconds(segment.durationInSeconds)}`}
              className={cn(
                "flex size-full flex-col justify-between overflow-hidden rounded-md border p-1 text-left text-[0.625rem]",
                "transition-[border-color,background-color] duration-150",
                isScene
                  ? "cursor-pointer border-border bg-surface hover:border-border-strong"
                  : "border-dashed border-border-strong bg-surface-subtle text-fg-subtle",
                isSelected && "bg-brand-soft",
                isActive && "border-brand ring-1 ring-brand/40",
              )}
            >
              <span className="truncate font-medium text-fg-muted">{segment.label}</span>
              <span className="truncate text-fg-subtle tabular-nums">
                {formatSeconds(segment.durationInSeconds)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
});
