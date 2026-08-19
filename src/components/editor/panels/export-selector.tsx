"use client";

import { AlertTriangle } from "lucide-react";
import type { EditorController } from "@/components/editor/use-editor";
import { Checkbox } from "@/components/ui/checkbox";
import {
  estimateFileSizeInBytes,
  EXPORT_PRESETS,
  exportWarnings,
  type ExportWarning,
} from "@/lib/editor/export-presets";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Voor welke platformen er geëxporteerd wordt.
 *
 * De waarschuwingen staan hier en niet pas na het renderen: een Reel die te
 * lang is, weet je nu al — na twintig minuten renderen is dat nieuws dat te
 * laat komt. Een afwijkende beeldverhouding houdt niets tegen (er wordt
 * bijgesneden), een lengte die het platform weigert wel.
 */

export function collectWarnings(editor: EditorController): ExportWarning[] {
  return editor.document.exportPresetIds.flatMap((presetId) => {
    const preset = EXPORT_PRESETS.find((item) => item.id === presetId);
    if (!preset) return [];

    return exportWarnings(preset, editor.document.aspectRatio, editor.durationInSeconds);
  });
}

export function ExportPresetList({ editor }: { editor: EditorController }) {
  const { exportPresetIds } = editor.document;

  return (
    <ul className="space-y-1.5">
      {EXPORT_PRESETS.map((preset) => {
        const isChosen = exportPresetIds.includes(preset.id);
        const warnings = isChosen
          ? exportWarnings(preset, editor.document.aspectRatio, editor.durationInSeconds)
          : [];
        const Icon = preset.icon;

        return (
          <li
            key={preset.id}
            className={cn(
              "rounded-md border p-2 transition-[border-color,background-color] duration-150",
              isChosen ? "border-brand bg-brand-soft/50" : "border-border bg-surface",
            )}
          >
            <Checkbox
              checked={isChosen}
              onChange={() => editor.toggleExportPreset(preset.id)}
              label={
                <span className="flex items-center gap-1.5 text-xs">
                  <Icon aria-hidden="true" className="size-3.5 text-fg-subtle" />
                  {preset.label}
                </span>
              }
              description={
                <span className="text-[0.6875rem]">
                  {preset.width}×{preset.height} · {preset.fps} fps ·{" "}
                  {formatBytes(estimateFileSizeInBytes(preset, editor.durationInSeconds))}
                </span>
              }
            />

            {warnings.map((warning) => (
              <p
                key={warning.message}
                className={cn(
                  "mt-1.5 flex items-start gap-1.5 text-[0.6875rem] leading-relaxed",
                  warning.level === "blokkerend" ? "text-danger" : "text-warning",
                )}
              >
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                {warning.message}
              </p>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
