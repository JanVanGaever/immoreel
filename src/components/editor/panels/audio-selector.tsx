"use client";

import { Music4 } from "lucide-react";
import type { EditorController } from "@/components/editor/use-editor";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AUDIO_MOOD_LABELS,
  findAudioTrack,
  listAudioTracks,
  MAX_FADE_SECONDS,
  needsLoop,
} from "@/lib/editor/audio";
import { formatSeconds } from "@/lib/format";
import type { AudioMood } from "@/lib/editor/audio";

/**
 * De muziek onder de video.
 *
 * Er wordt hier niets afgespeeld en niets gemixt: de editor kiest een nummer
 * en de volumes, de renderpijplijn legt het er straks onder. Zodra de
 * bestanden in de opslag staan, komt er een afspeelknop bij — de instellingen
 * zelf veranderen daar niet van.
 */
export function AudioSelector({ editor }: { editor: EditorController }) {
  const { audio } = editor.document;
  const track = findAudioTrack(audio.trackId);
  const tracks = listAudioTracks();

  const moods = [...new Set(tracks.map((item) => item.mood))] as AudioMood[];

  return (
    <div className="space-y-3">
      <Select
        selectSize="sm"
        aria-label="Muziek"
        value={audio.trackId ?? ""}
        onChange={(event) => editor.updateAudio({ trackId: event.target.value || null })}
      >
        <option value="">Geen muziek</option>
        {moods.map((mood) => (
          <optgroup key={mood} label={AUDIO_MOOD_LABELS[mood]}>
            {tracks
              .filter((item) => item.mood === mood)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.bpm} bpm
                </option>
              ))}
          </optgroup>
        ))}
      </Select>

      {track ? (
        <p className="flex items-center gap-1.5 text-[0.6875rem] text-fg-muted">
          <Music4 aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />
          {formatSeconds(track.durationInSeconds)} lang
          {needsLoop(track, editor.durationInSeconds)
            ? " — korter dan de video, het nummer wordt herhaald."
            : null}
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1 flex items-baseline justify-between gap-2 text-[0.6875rem] text-fg-muted">
          Volume
          <span className="font-medium text-fg tabular-nums">{Math.round(audio.volume * 100)} %</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={audio.volume}
          disabled={!track}
          onChange={(event) => editor.updateAudio({ volume: Number(event.target.value) })}
          className="w-full accent-[var(--color-brand)] disabled:opacity-50"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 flex items-baseline justify-between gap-1 text-[0.6875rem] text-fg-muted">
            Fade in
            <span className="text-fg tabular-nums">{formatSeconds(audio.fadeInSeconds)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={MAX_FADE_SECONDS}
            step={0.5}
            value={audio.fadeInSeconds}
            disabled={!track}
            onChange={(event) => editor.updateAudio({ fadeInSeconds: Number(event.target.value) })}
            className="w-full accent-[var(--color-brand)] disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-baseline justify-between gap-1 text-[0.6875rem] text-fg-muted">
            Fade out
            <span className="text-fg tabular-nums">{formatSeconds(audio.fadeOutSeconds)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={MAX_FADE_SECONDS}
            step={0.5}
            value={audio.fadeOutSeconds}
            disabled={!track}
            onChange={(event) => editor.updateAudio({ fadeOutSeconds: Number(event.target.value) })}
            className="w-full accent-[var(--color-brand)] disabled:opacity-50"
          />
        </label>
      </div>

      <Switch
        checked={audio.duckUnderVoiceover}
        disabled={!track}
        onCheckedChange={(checked) => editor.updateAudio({ duckUnderVoiceover: checked })}
        label={<span className="text-xs text-fg">Zachter onder een voice-over</span>}
      />
    </div>
  );
}
