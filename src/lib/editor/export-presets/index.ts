/**
 * De exportbibliotheek.
 *
 * Vier stukken, elk met één taak:
 *
 * - `catalog.ts`   welke platformen en presets er zijn (hier voeg je toe)
 * - `safe-areas.ts` welke randen elk platform met zijn eigen knoppen bedekt
 * - `filenames.ts` hoe een export heet zodra ze gedownload is
 * - `selection.ts` meerdere platformen tegelijk: schatten, waarschuwen, kiezen
 *
 * De types staan in `src/types/export.ts`, zodat de renderworker ze kan lezen
 * zonder deze module — en dus zonder de editor — mee te slepen.
 *
 * Importeer bij voorkeur via deze barrel:
 * `import { EXPORT_PRESETS, buildExportBatch } from "@/lib/editor/export-presets";`
 */

export {
  defaultPresetIdsForGoal,
  EXPORT_PLATFORMS,
  EXPORT_PRESETS,
  exportPlatformLabel,
  findExportPlatform,
  findExportPreset,
  groupPresetsByPlatform,
  isExportPresetId,
  normaliseExportPresetIds,
  presetsForPlatform,
  presetsForRatio,
  suggestedPresetIds,
} from "@/lib/editor/export-presets/catalog";
export type { PlatformGroup } from "@/lib/editor/export-presets/catalog";

export {
  describeSafeArea,
  safeAreaCoverage,
  safeAreaInsets,
  safeAreaRect,
  SAFE_AREA_FACEBOOK,
  SAFE_AREA_INSTAGRAM_FEED,
  SAFE_AREA_INSTAGRAM_REELS,
  SAFE_AREA_LINKEDIN,
  SAFE_AREA_TIKTOK,
  SAFE_AREA_WEBSITE,
  SAFE_AREA_WHATSAPP,
} from "@/lib/editor/export-presets/safe-areas";
export type { SafeAreaInsets } from "@/lib/editor/export-presets/safe-areas";

export {
  buildExportFileName,
  buildExportFileNames,
  slugify,
} from "@/lib/editor/export-presets/filenames";
export type { ExportFileNameInput } from "@/lib/editor/export-presets/filenames";

export {
  buildExportBatch,
  describeFormat,
  estimateFileSizeInBytes,
  exportWarnings,
  fittingPresetIds,
  formatBitrate,
  platformSelectionState,
  setPlatformPresets,
  togglePresetId,
} from "@/lib/editor/export-presets/selection";
export type {
  ExportContext,
  PlatformSelectionState,
} from "@/lib/editor/export-presets/selection";

/** Voor wie de preset en de types uit dezelfde plek wil halen. */
export type {
  ExportBatch,
  ExportItem,
  ExportPlatform,
  ExportPlatformInfo,
  ExportPreset,
  ExportWarning,
  SafeArea,
} from "@/types";
