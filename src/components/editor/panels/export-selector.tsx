"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Briefcase,
  Camera,
  Clapperboard,
  Globe,
  MessageCircle,
  Music2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SafeAreaFrame } from "@/components/editor/panels/safe-area-frame";
import type { EditorController } from "@/components/editor/use-editor";
import { Checkbox } from "@/components/ui/checkbox";
import {
  buildExportBatch,
  describeFormat,
  describeSafeArea,
  fittingPresetIds,
  groupPresetsByPlatform,
  platformSelectionState,
  type ExportContext,
} from "@/lib/editor/export-presets";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExportBatch, ExportItem, ExportPlatform, ExportPreset } from "@/types";

/**
 * Voor welke platformen er geëxporteerd wordt.
 *
 * Eén video gaat zelden naar één plek: het pand staat op de site, in de
 * Facebook-tijdlijn en als Reel. Daarom is dit een lijst met vinkjes en geen
 * keuzerondje — alles wat hier aanstaat, wordt straks één render.
 *
 * De waarschuwingen staan hier en niet pas na het renderen: een Reel die te
 * lang is, weet je nu al, en na twintig minuten renderen is dat nieuws dat te
 * laat komt. Een afwijkende beeldverhouding houdt niets tegen (er wordt
 * bijgesneden), een lengte die het platform weigert wel.
 */

/**
 * Lucide heeft geen merklogo's, en die horen ook niet in een interface van
 * derden. Deze iconen zeggen wat voor soort plek het is — een tijdlijn, een
 * gesprek, schermvullend beeld — en dat is precies wat je bij het kiezen nodig
 * hebt.
 */
export const PLATFORM_ICONS: Record<ExportPlatform, LucideIcon> = {
  website: Globe,
  linkedin: Briefcase,
  facebook: Users,
  "instagram-feed": Camera,
  "instagram-reels": Clapperboard,
  tiktok: Music2,
  whatsapp: MessageCircle,
};

/** Wat het project nú is; alles wat de batch berekent, hangt hieraan. */
export function exportContext(editor: EditorController): ExportContext {
  return {
    aspectRatio: editor.document.aspectRatio,
    durationInSeconds: editor.durationInSeconds,
    sceneCount: editor.scenes.length,
    title: editor.document.title,
  };
}

/**
 * De volledige doorrekening van de huidige selectie. Het exportvenster en deze
 * lijst gebruiken allebei deze hook, zodat wat je aanvinkt en wat je verstuurt
 * onmogelijk uit elkaar kunnen lopen.
 */
export function useExportBatch(editor: EditorController): ExportBatch {
  const { exportPresetIds, aspectRatio, title } = editor.document;
  const { durationInSeconds, scenes } = editor;

  return useMemo(
    () =>
      buildExportBatch(exportPresetIds, {
        aspectRatio,
        durationInSeconds,
        sceneCount: scenes.length,
        title,
      }),
    [exportPresetIds, aspectRatio, durationInSeconds, scenes.length, title],
  );
}

export function ExportPresetList({ editor }: { editor: EditorController }) {
  const batch = useExportBatch(editor);
  const chosen = new Set(editor.document.exportPresetIds);
  const itemsByPreset = new Map(batch.items.map((item) => [item.preset.id, item]));

  const fitting = fittingPresetIds(exportContext(editor));

  return (
    <div className="space-y-2">
      <QuickChoices editor={editor} fitting={fitting} chosenCount={chosen.size} />

      <ul className="space-y-2">
        {groupPresetsByPlatform().map(({ platform, presets }) => {
          const Icon = PLATFORM_ICONS[platform.id];
          const state = platformSelectionState(editor.document.exportPresetIds, platform.id);

          return (
            <li key={platform.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-fg-muted">
                  <Icon aria-hidden="true" className="size-3.5" />
                  {platform.label}
                </span>

                {presets.length > 1 ? (
                  <button
                    type="button"
                    className="text-[0.6875rem] text-brand hover:underline"
                    onClick={() => editor.toggleExportPlatform(platform.id, state !== "alles")}
                  >
                    {state === "alles" ? "Geen" : "Beide formaten"}
                  </button>
                ) : null}
              </div>

              <ul className="space-y-1.5">
                {presets.map((preset) => (
                  <PresetRow
                    key={preset.id}
                    preset={preset}
                    item={itemsByPreset.get(preset.id) ?? null}
                    isChosen={chosen.has(preset.id)}
                    onToggle={() => editor.toggleExportPreset(preset.id)}
                  />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Twee snelkeuzes in plaats van tien vinkjes. "Wat past" kiest de formaten
 * waarvoor niets bijgesneden hoeft te worden; dat is bijna altijd waar iemand
 * mee begint.
 */
function QuickChoices({
  editor,
  fitting,
  chosenCount,
}: {
  editor: EditorController;
  fitting: string[];
  chosenCount: number;
}) {
  return (
    <div className="flex items-center gap-2 text-[0.6875rem]">
      <button
        type="button"
        className="rounded-md border border-border bg-surface px-2 py-1 text-fg-muted hover:border-border-strong hover:text-fg"
        onClick={() => editor.setExportPresets(fitting)}
        disabled={fitting.length === 0}
      >
        Past bij {editor.document.aspectRatio}
      </button>
      <button
        type="button"
        className="rounded-md border border-border bg-surface px-2 py-1 text-fg-muted hover:border-border-strong hover:text-fg disabled:opacity-50"
        onClick={() => editor.setExportPresets([])}
        disabled={chosenCount === 0}
      >
        Alles uitvinken
      </button>
    </div>
  );
}

function PresetRow({
  preset,
  item,
  isChosen,
  onToggle,
}: {
  preset: ExportPreset;
  item: ExportItem | null;
  isChosen: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={cn(
        "rounded-md border p-2 transition-[border-color,background-color] duration-150",
        isChosen ? "border-brand bg-brand-soft/50" : "border-border bg-surface",
      )}
    >
      <div className="flex items-start gap-2">
        <SafeAreaFrame preset={preset} className="mt-0.5" />

        <Checkbox
          checked={isChosen}
          onChange={onToggle}
          className="flex-1"
          label={<span className="text-xs">{preset.label}</span>}
          description={
            <span className="text-[0.6875rem]">
              {describeFormat(preset)}
              {item ? ` · ${formatBytes(item.estimatedSizeInBytes)}` : null}
            </span>
          }
        />
      </div>

      {isChosen ? (
        <div className="mt-1.5 space-y-1 pl-[3rem]">
          <p className="truncate text-[0.6875rem] text-fg-subtle" title={item?.fileName}>
            {item?.fileName}
          </p>

          <SafeAreaHints preset={preset} />

          {item?.warnings.map((warning) => (
            <p
              key={warning.code}
              className={cn(
                "flex items-start gap-1.5 text-[0.6875rem] leading-relaxed",
                warning.level === "blokkerend" ? "text-danger" : "text-warning",
              )}
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Waar je niets belangrijks mag zetten. Alleen zichtbaar bij een aangevinkte
 * preset: het is raad bij het maken van de video, geen keuzecriterium.
 */
function SafeAreaHints({ preset }: { preset: ExportPreset }) {
  if (preset.safeArea.hints.length === 0) return null;

  return (
    <details className="text-[0.6875rem] text-fg-muted">
      <summary className="cursor-pointer list-none text-fg-subtle hover:text-fg-muted">
        {describeSafeArea(preset)}
      </summary>
      <ul className="mt-1 space-y-0.5 pl-3">
        {preset.safeArea.hints.map((hint) => (
          <li key={hint} className="list-disc leading-relaxed">
            {hint}
          </li>
        ))}
      </ul>
    </details>
  );
}
