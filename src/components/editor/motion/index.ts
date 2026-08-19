// De motionmodule: per foto kiezen hoe de camera beweegt.
// import { MotionSettings } from "@/components/editor/motion";
//
// De componenten hieronder werken op losse waarden en niet op de
// editorcontroller, zodat ze ook buiten het scèneprofiel bruikbaar blijven.

export { MotionControls } from "@/components/editor/motion/motion-controls";
export { MotionMiniPreview } from "@/components/editor/motion/motion-mini-preview";
export { MotionPresetGrid } from "@/components/editor/motion/motion-preset-grid";
export { MotionSettings } from "@/components/editor/motion/motion-settings";
export { MotionThumbnail } from "@/components/editor/motion/motion-thumbnail";
export { useMotionLoop, usePrefersReducedMotion } from "@/components/editor/motion/use-motion-loop";

export type { MotionControlsProps } from "@/components/editor/motion/motion-controls";
export type { MotionMiniPreviewProps } from "@/components/editor/motion/motion-mini-preview";
export type { MotionPresetGridProps } from "@/components/editor/motion/motion-preset-grid";
export type { MotionSettingsProps } from "@/components/editor/motion/motion-settings";
export type { MotionThumbnailProps } from "@/components/editor/motion/motion-thumbnail";
export type { MotionLoop, MotionLoopOptions } from "@/components/editor/motion/use-motion-loop";
