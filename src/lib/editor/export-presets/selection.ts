import {
  EXPORT_PRESETS,
  findExportPreset,
  normaliseExportPresetIds,
  presetsForPlatform,
} from "@/lib/editor/export-presets/catalog";
import {
  buildExportFileNames,
  type ExportFileNameInput,
} from "@/lib/editor/export-presets/filenames";
import { formatNumber } from "@/lib/format";
import type {
  AspectRatio,
  ExportBatch,
  ExportItem,
  ExportPlatform,
  ExportPreset,
  ExportWarning,
  ID,
} from "@/types";

/**
 * Meerdere platformen tegelijk: wat er dan precies aangevraagd wordt, en wat
 * er aan mankeert.
 *
 * Eén render per platform is de normale gang van zaken — een pand gaat naar de
 * site, naar Facebook en naar Reels, en dat zijn drie bestanden van hetzelfde
 * project. Deze module rekent die hele selectie in één keer door, zodat de
 * editor, het exportvenster en de serveractie alle drie naar hetzelfde oordeel
 * kijken in plaats van elk hun eigen versie van "kan dit?" te maken.
 *
 * Belangrijk: alles hier is puur rekenwerk op de preset en op wat het project
 * nu is. Er wordt niets gerenderd, niets gemeten en niets bewaard.
 */

export type ExportContext = ExportFileNameInput & {
  /** De verhouding waarop het project staat; daarvan wordt eventueel bijgesneden. */
  aspectRatio: AspectRatio;
  durationInSeconds: number;
  /** Zonder foto's valt er niets te renderen. */
  sceneCount: number;
};

/* -------------------------------------------------------------------------
 * Schatten
 * ---------------------------------------------------------------------- */

/**
 * Ruwe schatting van de bestandsgrootte: bitrate maal duur. De encoder werkt
 * met CRF en haalt die bitrate zelden helemaal, dus dit is eerder een plafond
 * dan een voorspelling — precies goed om niemand te verrassen die het bestand
 * op mobiele data moet versturen.
 */
export function estimateFileSizeInBytes(preset: ExportPreset, durationInSeconds: number): number {
  const kbits = (preset.videoBitrateKbps + preset.audioBitrateKbps) * durationInSeconds;

  return Math.round((kbits * 1000) / 8);
}

/** "6 Mbit/s" of "800 kbit/s", afhankelijk van wat leesbaarder is. */
export function formatBitrate(kbps: number): string {
  if (kbps < 1000) return `${formatNumber(kbps)} kbit/s`;

  const mbps = kbps / 1000;

  // Via `formatNumber`, anders staat er een punt waar in het Nederlands een
  // komma hoort: 2.5 Mbit/s leest als vijfentwintig.
  return `${formatNumber(Math.round(mbps * 10) / 10)} Mbit/s`;
}

/** De regel onder een preset: "1080x1920 · 30 fps · 6 Mbit/s". */
export function describeFormat(preset: ExportPreset): string {
  return `${preset.width}x${preset.height} · ${preset.fps} fps · ${formatBitrate(preset.videoBitrateKbps)}`;
}

/* -------------------------------------------------------------------------
 * Waarschuwen
 * ---------------------------------------------------------------------- */

function warning(
  presetId: ID,
  code: ExportWarning["code"],
  level: ExportWarning["level"],
  message: string,
): ExportWarning {
  return { presetId, code, level, message };
}

function roundSeconds(seconds: number): number {
  return Math.round(seconds);
}

/**
 * Wat er misgaat als je nú exporteert.
 *
 * Het onderscheid is telkens hetzelfde: een `blokkerend`-waarschuwing gaat over
 * iets dat het platform weigert, en die houdt de export tegen. `let-op` gaat
 * over iets dat mag maar zelden een goed idee is — daar beslist de makelaar
 * zelf over. Een verkeerde verhouding is bewust geen blokkade: bijsnijden naar
 * een ander formaat is een normale werkwijze en soms precies de bedoeling.
 */
export function exportWarnings(preset: ExportPreset, context: ExportContext): ExportWarning[] {
  const warnings: ExportWarning[] = [];
  const duration = context.durationInSeconds;

  if (preset.aspectRatio !== context.aspectRatio) {
    warnings.push(
      warning(
        preset.id,
        "andere-verhouding",
        "let-op",
        `Het project staat op ${context.aspectRatio}; voor ${preset.label} wordt er naar ${preset.aspectRatio} bijgesneden.`,
      ),
    );
  }

  if (preset.maxDurationInSeconds !== null && duration > preset.maxDurationInSeconds) {
    warnings.push(
      warning(
        preset.id,
        "te-lang",
        "blokkerend",
        `${preset.label} laat maximaal ${preset.maxDurationInSeconds} seconden toe; deze video duurt ${roundSeconds(duration)} seconden.`,
      ),
    );
  }

  if (preset.minDurationInSeconds !== null && duration < preset.minDurationInSeconds) {
    warnings.push(
      warning(
        preset.id,
        "te-kort",
        "blokkerend",
        `${preset.label} vraagt minstens ${preset.minDurationInSeconds} seconden.`,
      ),
    );
  }

  // Alleen zeuren over de aanbeveling wanneer de lengte niet al geweigerd wordt.
  const blocked = warnings.some((entry) => entry.level === "blokkerend");
  const range = preset.recommendedDuration;

  if (!blocked && range && duration > range.maxInSeconds) {
    warnings.push(
      warning(
        preset.id,
        "buiten-aanbeveling",
        "let-op",
        `Op ${preset.label} kijkt bijna niemand langer dan ${range.maxInSeconds} seconden; deze video duurt ${roundSeconds(duration)}.`,
      ),
    );
  }

  if (
    preset.maxFileSizeInBytes !== null &&
    estimateFileSizeInBytes(preset, duration) > preset.maxFileSizeInBytes
  ) {
    warnings.push(
      warning(
        preset.id,
        "te-zwaar",
        "let-op",
        `${preset.label} wordt naar schatting te groot om zo te versturen; kort de video in of laat er scènes uit.`,
      ),
    );
  }

  return warnings;
}

/* -------------------------------------------------------------------------
 * De hele selectie
 * ---------------------------------------------------------------------- */

/**
 * Alles wat er bij deze selectie hoort: per platform een bestand met een naam,
 * een schatting en een oordeel, en over het geheel of exporteren nu kan.
 *
 * De ids worden eerst opgeschoond (`normaliseExportPresetIds`), dus oude ids
 * uit een bestaand project werken hier gewoon. Wat helemaal niet meer bestaat
 * komt in `unknownPresetIds` terecht in plaats van er stil tussenuit te vallen.
 */
export function buildExportBatch(presetIds: ID[], context: ExportContext): ExportBatch {
  const resolved = normaliseExportPresetIds(presetIds);
  const unknownPresetIds = presetIds.filter((id) => findExportPreset(id) === null);

  const presets = resolved
    .map((id) => findExportPreset(id))
    .filter((preset): preset is ExportPreset => preset !== null);

  const fileNames = buildExportFileNames(presets, context);

  const items: ExportItem[] = presets.map((preset) => ({
    preset,
    fileName: fileNames.get(preset.id) ?? `${preset.id}.${preset.container}`,
    estimatedSizeInBytes: estimateFileSizeInBytes(preset, context.durationInSeconds),
    warnings: exportWarnings(preset, context),
  }));

  const warnings = items.flatMap((item) => item.warnings);

  if (context.sceneCount === 0) {
    // Hoort bij de batch en niet bij één preset: er is niets om te renderen,
    // welk platform je ook aanvinkt.
    warnings.push(warning("", "geen-scenes", "blokkerend", "Voeg eerst foto's toe aan de video."));
  }

  const blocking = warnings.filter((entry) => entry.level === "blokkerend");

  return {
    items,
    unknownPresetIds,
    warnings,
    blocking,
    totalEstimatedSizeInBytes: items.reduce((total, item) => total + item.estimatedSizeInBytes, 0),
    canExport: items.length > 0 && blocking.length === 0,
  };
}

/* -------------------------------------------------------------------------
 * Aan- en uitvinken
 * ---------------------------------------------------------------------- */

/** Eén preset omzetten; het resultaat staat altijd in catalogusvolgorde. */
export function togglePresetId(presetIds: ID[], presetId: ID): ID[] {
  const current = normaliseExportPresetIds(presetIds);
  const preset = findExportPreset(presetId);

  if (!preset) return current;

  return normaliseExportPresetIds(
    current.includes(preset.id)
      ? current.filter((id) => id !== preset.id)
      : [...current, preset.id],
  );
}

export type PlatformSelectionState = "geen" | "deels" | "alles";

export function platformSelectionState(
  presetIds: ID[],
  platform: ExportPlatform,
): PlatformSelectionState {
  const current = new Set(normaliseExportPresetIds(presetIds));
  const presets = presetsForPlatform(platform);
  const chosen = presets.filter((preset) => current.has(preset.id)).length;

  if (chosen === 0) return "geen";

  return chosen === presets.length ? "alles" : "deels";
}

/**
 * Een heel platform aan- of uitzetten. Aanzetten kiest alle formaten van dat
 * platform: wie op Facebook duwt, wil meestal zowel het vierkante als het
 * portretformaat klaar hebben staan.
 */
export function setPlatformPresets(presetIds: ID[], platform: ExportPlatform, on: boolean): ID[] {
  const current = normaliseExportPresetIds(presetIds);
  const ids = presetsForPlatform(platform).map((preset) => preset.id);

  return normaliseExportPresetIds(
    on ? [...current, ...ids] : current.filter((id) => !ids.includes(id)),
  );
}

/**
 * De presets waarvoor deze video nu al klaar is: het formaat klopt en de
 * lengte wordt niet geweigerd. Dat is de snelknop "wat past er?" in het
 * exportvenster.
 */
export function fittingPresetIds(context: ExportContext): ID[] {
  return EXPORT_PRESETS.filter(
    (preset) =>
      preset.aspectRatio === context.aspectRatio &&
      exportWarnings(preset, context).every((entry) => entry.level !== "blokkerend"),
  ).map((preset) => preset.id);
}
