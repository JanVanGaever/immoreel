import type { AudioSettings, ID } from "@/types";

/**
 * De muziekkeuze in de editor.
 *
 * De catalogus is licentievrije muziek die bij een pandvideo past. Er wordt
 * niets gegenereerd en niets gemixt in de browser: de editor kiest alleen een
 * nummer en een volume, de renderpijplijn legt het er straks onder.
 *
 * `previewUrl` is nu overal `null` — er staan nog geen bestanden in de opslag.
 * Zodra die er zijn, kan de audioselector ze afspelen zonder dat er aan de
 * vorm iets verandert.
 */

export type AudioMood = "rustig" | "warm" | "modern" | "energiek" | "filmisch";

export type AudioTrack = {
  id: ID;
  name: string;
  mood: AudioMood;
  /** Lengte van het nummer; korter dan de video betekent loopen. */
  durationInSeconds: number;
  bpm: number;
  previewUrl: string | null;
};

export const AUDIO_MOOD_LABELS: Record<AudioMood, string> = {
  rustig: "Rustig",
  warm: "Warm",
  modern: "Modern",
  energiek: "Energiek",
  filmisch: "Filmisch",
};

const TRACKS: AudioTrack[] = [
  {
    id: "trk_zacht_piano",
    name: "Zachte piano",
    mood: "rustig",
    durationInSeconds: 124,
    bpm: 72,
    previewUrl: null,
  },
  {
    id: "trk_warme_gitaar",
    name: "Warme gitaar",
    mood: "warm",
    durationInSeconds: 138,
    bpm: 88,
    previewUrl: null,
  },
  {
    id: "trk_lichte_beat",
    name: "Lichte beat",
    mood: "modern",
    durationInSeconds: 96,
    bpm: 104,
    previewUrl: null,
  },
  {
    id: "trk_stadspuls",
    name: "Stadspuls",
    mood: "energiek",
    durationInSeconds: 88,
    bpm: 122,
    previewUrl: null,
  },
  {
    id: "trk_strijkers",
    name: "Strijkers",
    mood: "filmisch",
    durationInSeconds: 152,
    bpm: 68,
    previewUrl: null,
  },
];

/** TODO: uit de mediabibliotheek van de organisatie zodra die er staat. */
export function listAudioTracks(): AudioTrack[] {
  return TRACKS;
}

export function findAudioTrack(trackId: ID | null | undefined): AudioTrack | null {
  if (!trackId) return null;

  return TRACKS.find((track) => track.id === trackId) ?? null;
}

export const DEFAULT_AUDIO: AudioSettings = {
  trackId: "trk_warme_gitaar",
  volume: 0.7,
  fadeInSeconds: 1,
  fadeOutSeconds: 2,
  duckUnderVoiceover: true,
};

export function createAudio(overrides: Partial<AudioSettings> = {}): AudioSettings {
  return { ...DEFAULT_AUDIO, ...overrides };
}

export const MAX_FADE_SECONDS = 5;

export function clampAudio(audio: AudioSettings): AudioSettings {
  const clamp = (value: number, max: number) =>
    Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0;

  return {
    ...audio,
    volume: clamp(audio.volume, 1),
    fadeInSeconds: clamp(audio.fadeInSeconds, MAX_FADE_SECONDS),
    fadeOutSeconds: clamp(audio.fadeOutSeconds, MAX_FADE_SECONDS),
  };
}

/** Loopt het nummer meer dan één keer rond onder deze video? */
export function needsLoop(track: AudioTrack | null, videoDurationInSeconds: number): boolean {
  if (!track) return false;

  return videoDurationInSeconds > track.durationInSeconds;
}
