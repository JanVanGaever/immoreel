"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import type { EditorController } from "@/components/editor/use-editor";
import { Button, IconButton } from "@/components/ui/button";
import { MAX_SCENE_SECONDS, MIN_SCENE_SECONDS } from "@/lib/editor/document";
import { findMotionPreset, MOTION_PRESETS, presetMotionChanges } from "@/lib/editor/motion";
import { TRANSITION_OPTIONS } from "@/lib/editor/templates";
import { formatSeconds } from "@/lib/format";

const PRESET_SECONDS = [2, 2.5, 3, 4, 5, 6];

const selectClassName =
  "h-7 w-full rounded-md border border-border bg-surface px-1.5 text-[0.6875rem] text-fg " +
  "hover:border-border-strong focus:border-brand focus:outline-none";

/**
 * Bulk edit: dezelfde instelling op alles wat aangevinkt staat.
 *
 * De balk verschijnt pas bij een selectie en verdwijnt weer, zodat er geen
 * tweede set knoppen permanent in beeld staat. "Verdelen" is de reden dat dit
 * bestaat: een makelaar denkt in "die video mag 30 seconden duren", niet in
 * "elke foto 2,5 seconde".
 */
export function BulkEditBar({ editor }: { editor: EditorController }) {
  const count = editor.state.selectedSceneIds.length;
  const [total, setTotal] = useState("30");

  if (count === 0) return null;

  const selectedSeconds = editor.selectedScenes.reduce(
    (sum, scene) => sum + scene.durationInSeconds,
    0,
  );
  const totalSeconds = Number(total);
  const canSpread =
    Number.isFinite(totalSeconds) &&
    totalSeconds >= MIN_SCENE_SECONDS * count &&
    totalSeconds <= MAX_SCENE_SECONDS * count;

  return (
    <div className="space-y-2 bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg">
          {count} {count === 1 ? "foto" : "foto's"} geselecteerd
          <span className="ml-1.5 font-normal text-fg-subtle tabular-nums">
            {formatSeconds(selectedSeconds)}
          </span>
        </p>
        <IconButton
          label="Selectie wissen"
          variant="ghost"
          size="icon-sm"
          onClick={editor.clearSelection}
        >
          <X />
        </IconButton>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <select
          value=""
          aria-label="Duur van de selectie"
          className={selectClassName}
          onChange={(event) => editor.setDuration(Number(event.target.value))}
        >
          <option value="" disabled>
            Duur zetten…
          </option>
          {PRESET_SECONDS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {formatSeconds(seconds)} per foto
            </option>
          ))}
        </select>

        <select
          value=""
          aria-label="Beweging van de selectie"
          className={selectClassName}
          onChange={(event) => {
            const preset = findMotionPreset(event.target.value);
            // Zonder het focuspunt: dat staat per foto ergens anders, en een
            // bulkbewerking hoort dat niet allemaal naar het midden te trekken.
            if (preset) editor.updateMotion(presetMotionChanges(preset));
          }}
        >
          <option value="" disabled>
            Beweging zetten…
          </option>
          {MOTION_PRESETS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value=""
          aria-label="Overgang van de selectie"
          className={selectClassName}
          onChange={(event) =>
            editor.setTransition(
              event.target.value as (typeof TRANSITION_OPTIONS)[number]["id"],
              editor.state.selectedSceneIds,
            )
          }
        >
          <option value="" disabled>
            Overgang zetten…
          </option>
          {TRANSITION_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <Button
          variant="danger"
          size="sm"
          className="w-full"
          onClick={() => editor.removeScenes(editor.state.selectedSceneIds)}
        >
          <Trash2 />
          Verwijderen
        </Button>
      </div>

      <div className="flex items-end gap-1.5">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[0.6875rem] text-fg-muted">
            Verdeel de selectie over
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={MIN_SCENE_SECONDS * count}
            max={MAX_SCENE_SECONDS * count}
            step={0.5}
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            className="h-7 w-full rounded-md border border-border bg-surface px-2 text-[0.6875rem] text-fg tabular-nums hover:border-border-strong focus:border-brand focus:outline-none"
          />
        </label>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canSpread}
          onClick={() => editor.spreadDuration(totalSeconds)}
        >
          Verdelen
        </Button>
      </div>
    </div>
  );
}
