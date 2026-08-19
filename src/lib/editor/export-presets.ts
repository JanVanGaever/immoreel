import { Briefcase, Camera, Globe, MessageCircle, Music2, type LucideIcon } from "lucide-react";
import type { AspectRatio, ID } from "@/types";

/**
 * Waar de video naartoe gaat.
 *
 * Eén preset is alles wat de renderpijplijn nodig heeft om een bestand te
 * maken: formaat, resolutie, framerate, bitrate en de grens die het platform
 * zelf oplegt. De editor gebruikt dezelfde waarden om te waarschuwen vóór het
 * exporteren — een Reel van drie minuten is beter tegen te houden in de editor
 * dan na twintig minuten renderen.
 *
 * De ids komen overeen met de doelen uit de wizard (`ProjectGoal`), zodat een
 * project dat voor Instagram gemaakt is meteen de juiste export voorstelt.
 */

export type ExportPreset = {
  id: ID;
  label: string;
  description: string;
  icon: LucideIcon;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  fps: number;
  /** Videobitrate in kbit/s. */
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  container: "mp4";
  /** Wat het platform toelaat; `null` als er geen harde grens is. */
  maxDurationInSeconds: number | null;
  /** Onder deze lengte valt de video op het platform uit de boot. */
  minDurationInSeconds: number | null;
};

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "website",
    label: "Website & YouTube",
    description: "1080p liggend, voor je eigen zoekertje of een e-mail.",
    icon: Globe,
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 192,
    container: "mp4",
    maxDurationInSeconds: null,
    minDurationInSeconds: null,
  },
  {
    id: "instagram",
    label: "Instagram Reels",
    description: "Staand 1080x1920. Reels kappen af na 90 seconden.",
    icon: Camera,
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrateKbps: 6000,
    audioBitrateKbps: 128,
    container: "mp4",
    maxDurationInSeconds: 90,
    minDurationInSeconds: 3,
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "Staand, iets hogere bitrate omdat TikTok stevig hercomprimeert.",
    icon: Music2,
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrateKbps: 7000,
    audioBitrateKbps: 128,
    container: "mp4",
    maxDurationInSeconds: 600,
    minDurationInSeconds: 3,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Vierkant 1080x1080; neemt veel plaats in een zakelijke tijdlijn.",
    icon: Briefcase,
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    fps: 30,
    videoBitrateKbps: 5000,
    audioBitrateKbps: 128,
    container: "mp4",
    maxDurationInSeconds: 600,
    minDurationInSeconds: 3,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Staand en licht: klein genoeg om rechtstreeks te versturen.",
    icon: MessageCircle,
    aspectRatio: "9:16",
    width: 720,
    height: 1280,
    fps: 30,
    videoBitrateKbps: 2500,
    audioBitrateKbps: 96,
    container: "mp4",
    maxDurationInSeconds: 90,
    minDurationInSeconds: null,
  },
];

const PRESETS_BY_ID = new Map(EXPORT_PRESETS.map((preset) => [preset.id, preset]));

export function findExportPreset(presetId: ID): ExportPreset | null {
  return PRESETS_BY_ID.get(presetId) ?? null;
}

export function isExportPresetId(value: unknown): value is ID {
  return typeof value === "string" && PRESETS_BY_ID.has(value);
}

/** De presets die exact bij de beeldverhouding van het project passen. */
export function presetsForRatio(ratio: AspectRatio): ExportPreset[] {
  return EXPORT_PRESETS.filter((preset) => preset.aspectRatio === ratio);
}

export type ExportWarning = {
  presetId: ID;
  level: "let-op" | "blokkerend";
  message: string;
};

/**
 * Wat er misgaat als je nú exporteert. Een verkeerde verhouding houdt de
 * export niet tegen — er wordt bijgesneden, en soms is dat precies de
 * bedoeling — maar een video die het platform weigert wel.
 */
export function exportWarnings(
  preset: ExportPreset,
  projectRatio: AspectRatio,
  durationInSeconds: number,
): ExportWarning[] {
  const warnings: ExportWarning[] = [];

  if (preset.aspectRatio !== projectRatio) {
    warnings.push({
      presetId: preset.id,
      level: "let-op",
      message: `Het project staat op ${projectRatio}; voor ${preset.label} wordt er naar ${preset.aspectRatio} bijgesneden.`,
    });
  }

  if (preset.maxDurationInSeconds !== null && durationInSeconds > preset.maxDurationInSeconds) {
    warnings.push({
      presetId: preset.id,
      level: "blokkerend",
      message: `${preset.label} laat maximaal ${preset.maxDurationInSeconds} seconden toe; deze video duurt ${Math.round(durationInSeconds)} seconden.`,
    });
  }

  if (preset.minDurationInSeconds !== null && durationInSeconds < preset.minDurationInSeconds) {
    warnings.push({
      presetId: preset.id,
      level: "blokkerend",
      message: `${preset.label} vraagt minstens ${preset.minDurationInSeconds} seconden.`,
    });
  }

  return warnings;
}

/** Ruwe schatting van de bestandsgrootte, om niemand te verrassen op mobiel. */
export function estimateFileSizeInBytes(preset: ExportPreset, durationInSeconds: number): number {
  const kbits = (preset.videoBitrateKbps + preset.audioBitrateKbps) * durationInSeconds;

  return Math.round((kbits * 1000) / 8);
}
