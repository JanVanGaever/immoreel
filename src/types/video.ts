import type { ID, Timestamps } from "@/types/common";

export type MediaKind = "image" | "video" | "audio" | "document";

export type MediaAsset = {
  id: ID;
  organisationId: ID;
  propertyId?: ID | null;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
  width?: number | null;
  height?: number | null;
  durationInSeconds?: number | null;
  storageKey: string;
  thumbnailUrl?: string | null;
} & Timestamps;

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export type ProjectStatus =
  | "concept"
  | "in-bewerking"
  | "wachtrij"
  | "renderen"
  | "klaar"
  | "mislukt";

/**
 * Hoe de camera over één foto beweegt. Deze waarden zijn bewust
 * resolutie-onafhankelijk: de editor rekent ze om naar een CSS-transform voor
 * de preview, de renderpijplijn naar een `zoompan`-filter voor FFmpeg. Beide
 * doen dat met dezelfde functies uit `src/lib/editor/motion.ts`, zodat wat je
 * in de browser ziet ook is wat er gerenderd wordt.
 */
export type MotionKind =
  | "geen"
  | "inzoomen"
  | "uitzoomen"
  | "pan-links"
  | "pan-rechts"
  | "pan-omhoog"
  | "pan-omlaag"
  | "ken-burns";

/**
 * Hoe de beweging over de scène verdeeld is. Een lineaire pan begint en eindigt
 * abrupt; `zacht` laat de camera op gang komen en weer uitbollen, wat op een
 * pandvideo bijna altijd rustiger oogt.
 */
export type MotionEasing = "lineair" | "zacht" | "start-traag" | "eind-traag";

export type SceneMotion = {
  kind: MotionKind;
  /**
   * Hoe ver de camera reist, van 0 (niets) tot 1 (het maximum dat we toelaten
   * zonder dat de foto zichtbaar zacht wordt). Bewust een getal en geen drie
   * vaste standen: de presets zetten er waarden in, de gebruiker mag ertussen
   * gaan zitten.
   */
  intensity: number;
  /**
   * Tempo ten opzichte van de scène. 1 betekent dat de beweging precies de
   * scène vult. Onder 1 maakt ze haar traject niet af — dat is wat een "slow
   * zoom" traag maakt. Boven 1 is ze vroeger klaar en staat het beeld daarna
   * stil.
   */
  speed: number;
  easing: MotionEasing;
  /**
   * Waar in de foto de beweging naartoe werkt, als fractie van breedte en
   * hoogte (0 = links/boven, 1 = rechts/onder). Bij zoomen is dit het punt dat
   * in beeld blijft; bij pannen bepaalt het de andere as.
   */
  focusX: number;
  focusY: number;
};

/** Een scène is één blok in de tijdlijn van de editor. */
export type Scene = {
  id: ID;
  order: number;
  assetId?: ID | null;
  durationInSeconds: number;
  motion: SceneMotion;
  transition?: string | null;
  captionTop?: string | null;
  captionBottom?: string | null;
};

/** Waar het logo in beeld staat. */
export type LogoPlacement = "geen" | "linksboven" | "rechtsboven" | "linksonder" | "rechtsonder";

/**
 * De huisstijl zoals die over deze video ligt. De kit zelf (logo, kleuren,
 * lettertype) hoort bij de organisatie; hier staat alleen wat dit project
 * ervan gebruikt.
 */
export type BrandingSettings = {
  brandKitId: ID | null;
  logoPlacement: LogoPlacement;
  /** Slotkaart met naam en telefoonnummer van de makelaar. */
  showContactCard: boolean;
  /** Prijsblok over de eerste scène. */
  showPriceBadge: boolean;
  /** Overschrijft de kleur van de kit; `null` betekent: neem die van de kit. */
  accentColor: string | null;
  agentName: string | null;
  agentPhone: string | null;
};

export type AudioSettings = {
  trackId: ID | null;
  /** 0 tot 1. */
  volume: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  /** Muziek zachter zetten zolang er een voice-over loopt. */
  duckUnderVoiceover: boolean;
};

export type VideoProject = {
  id: ID;
  organisationId: ID;
  propertyId?: ID | null;
  title: string;
  status: ProjectStatus;
  aspectRatio: AspectRatio;
  templateId?: ID | null;
  scenes: Scene[];
  branding: BrandingSettings;
  audio: AudioSettings;
  /** Platformen waarvoor de gebruiker exporteert (zie `lib/editor/export-presets.ts`). */
  exportPresetIds: ID[];
  musicAssetId?: ID | null;
  voiceoverAssetId?: ID | null;
  posterUrl?: string | null;
  durationInSeconds: number;
} & Timestamps;

export type RenderJobStatus = "wachtrij" | "bezig" | "geslaagd" | "mislukt" | "geannuleerd";

export type RenderJob = {
  id: ID;
  projectId: ID;
  status: RenderJobStatus;
  progress: number;
  outputUrl?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
} & Timestamps;

/** Een herbruikbare huisstijl-template (intro, outro, kleuren, lettertype). */
export type Template = {
  id: ID;
  organisationId?: ID | null;
  name: string;
  description?: string | null;
  aspectRatios: AspectRatio[];
  previewUrl?: string | null;
} & Timestamps;
