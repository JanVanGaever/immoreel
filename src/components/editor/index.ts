// De editor: foto's links, preview in het midden, instellingen rechts.
// import { EditorShell } from "@/components/editor";

export { EditorShell } from "@/components/editor/editor-shell";
export { EditorTopbar } from "@/components/editor/editor-topbar";
export { ExportDialog } from "@/components/editor/export-dialog";
export { EditorPanel, PanelSection, PanelStat } from "@/components/editor/panel";
export { SaveIndicator } from "@/components/editor/save-indicator";
export { useAutosave } from "@/components/editor/use-autosave";
export { useEditor } from "@/components/editor/use-editor";
export { usePlayback } from "@/components/editor/use-playback";

export {
  MotionControls,
  MotionMiniPreview,
  MotionPresetGrid,
  MotionSettings,
  MotionThumbnail,
  useMotionLoop,
  usePrefersReducedMotion,
} from "@/components/editor/motion";

export {
  PreviewControls,
  PreviewDialog,
  PreviewPlayer,
  PreviewScreen,
  PreviewSlides,
  usePreviewPlan,
  usePreviewPlayback,
} from "@/components/editor/preview";

export { AssetPanel } from "@/components/editor/panels/asset-panel";
export { AssetRow } from "@/components/editor/panels/asset-row";
export { AspectRatioSelector } from "@/components/editor/panels/aspect-ratio-selector";
export { AudioSelector } from "@/components/editor/panels/audio-selector";
export { BrandingSelector } from "@/components/editor/panels/branding-selector";
export { BulkEditBar } from "@/components/editor/panels/bulk-edit-bar";
export { DurationSlider, DurationStepper } from "@/components/editor/panels/duration-field";
export {
  ExportPresetList,
  exportContext,
  PLATFORM_ICONS,
  useExportBatch,
} from "@/components/editor/panels/export-selector";
export { PreviewStage } from "@/components/editor/panels/preview-stage";
export { SafeAreaFrame } from "@/components/editor/panels/safe-area-frame";
export { SceneSettings } from "@/components/editor/panels/scene-settings";
export { SettingsPanel } from "@/components/editor/panels/settings-panel";
export { StagePanel } from "@/components/editor/panels/stage-panel";
export { TemplateSelector } from "@/components/editor/panels/template-selector";
export { Timeline } from "@/components/editor/panels/timeline";

export type { EditorShellProps } from "@/components/editor/editor-shell";
export type { EditorPanelProps, PanelSectionProps } from "@/components/editor/panel";
export type { AutosaveController, SaveStatus } from "@/components/editor/use-autosave";
export type { EditorController, UseEditorOptions } from "@/components/editor/use-editor";
export type { PlaybackController } from "@/components/editor/use-playback";
export type {
  MotionControlsProps,
  MotionMiniPreviewProps,
  MotionPresetGridProps,
  MotionSettingsProps,
  MotionThumbnailProps,
} from "@/components/editor/motion";

export type {
  PreviewControlsProps,
  PreviewPlanState,
  PreviewPlayback,
  PreviewPlayerProps,
  PreviewScreenProps,
  PreviewSlidesProps,
} from "@/components/editor/preview";

export type { AssetRowProps } from "@/components/editor/panels/asset-row";
export type { PreviewStageProps } from "@/components/editor/panels/preview-stage";
export type { TimelineProps } from "@/components/editor/panels/timeline";
