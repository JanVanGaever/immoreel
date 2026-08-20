// De previewspeler: hoe de video ongeveer aanvoelt, vóór het renderen.
// import { PreviewPlayer } from "@/components/editor/preview";

export { PreviewControls } from "@/components/editor/preview/preview-controls";
export { PreviewDialog } from "@/components/editor/preview/preview-dialog";
export { PreviewPlayer } from "@/components/editor/preview/preview-player";
export { PreviewScreen } from "@/components/editor/preview/preview-screen";
export { PreviewSlides } from "@/components/editor/preview/preview-slides";
export { usePreviewPlan, RECOMPUTE_DELAY_MS } from "@/components/editor/preview/use-preview-plan";
export { usePreviewPlayback } from "@/components/editor/preview/use-preview-playback";

export type { PreviewControlsProps } from "@/components/editor/preview/preview-controls";
export type { PreviewPlayerProps } from "@/components/editor/preview/preview-player";
export type { PreviewScreenProps } from "@/components/editor/preview/preview-screen";
export type { PreviewSlidesProps } from "@/components/editor/preview/preview-slides";
export type { PreviewPlanState } from "@/components/editor/preview/use-preview-plan";
export type {
  PreviewPlayback,
  PreviewPlaybackOptions,
} from "@/components/editor/preview/use-preview-playback";
