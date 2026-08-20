import { access } from "node:fs/promises";
import { join } from "node:path";
import { findAudioTrack, type AudioTrack } from "@/lib/editor/audio";
import { audioLibraryDir } from "@/workers/config";
import type { AudioSettings, ID } from "@/types";

/**
 * De muziek onder de video.
 *
 * Twee dingen staan hier los van elkaar: wáár het bestand vandaan komt (de
 * poort hieronder) en wát ermee gebeurt (de filterketen). De catalogus in
 * `src/lib/editor/audio.ts` is vandaag een vaste lijst zonder bestanden; zodra
 * die uit de mediabibliotheek komt, wisselt alleen de implementatie van de
 * poort.
 *
 * Ontbrekende muziek is bewust geen renderfout. Een video zonder muziek is
 * bruikbaar; een export die om vier uur 's nachts afbreekt omdat er een bestand
 * ontbreekt dat de gebruiker nooit zelf gekozen heeft, is dat niet.
 */

export type AudioLibrary = {
  readonly name: string;
  /** Het pad naar het bestand van dit nummer, of `null` als het er niet is. */
  find(trackId: ID): Promise<string | null>;
};

/** Volgorde waarin er naar een bestand van een nummer gezocht wordt. */
const AUDIO_EXTENSIONS = ["m4a", "mp3", "aac", "wav", "flac", "ogg"];

export function createLocalAudioLibrary(directory: string): AudioLibrary {
  return {
    name: "local",

    async find(trackId) {
      for (const extension of AUDIO_EXTENSIONS) {
        const candidate = join(directory, `${trackId}.${extension}`);

        try {
          await access(candidate);

          return candidate;
        } catch {
          // Volgende extensie.
        }
      }

      return null;
    },
  };
}

/** Geen `RENDER_AUDIO_DIR` betekent: er is geen muziek, en dat is geen fout. */
export function getAudioLibrary(): AudioLibrary | null {
  const directory = audioLibraryDir();

  return directory ? createLocalAudioLibrary(directory) : null;
}

/* -------------------------------------------------------------------------
 * De filterketen
 * ---------------------------------------------------------------------- */

export type AudioGraphInput = {
  settings: AudioSettings;
  /**
   * Hoe lang het bestand echt is, gemeten met ffprobe. `null` als dat niet
   * lukte; dan wordt er niet geloopt — liever stilte op het einde dan een
   * nummer dat halverwege opnieuw begint zonder dat iemand dat verwachtte.
   */
  trackDurationInSeconds: number | null;
  trackPath: string;
  /** Duur van de video; de muziek wordt hier exact op afgesneden. */
  durationInSeconds: number;
  /** Index van dit bestand tussen de `-i`-argumenten. */
  inputIndex: number;
  sampleRate: number;
};

export type AudioGraph = {
  /** De `-i` van de muziek, inclusief wat ervóór moet staan. */
  inputArgs: string[];
  /** De stap voor `-filter_complex`. */
  step: string;
  /** Label van de uitgang. */
  label: string;
};

/**
 * Muziek onder een video van precies deze lengte.
 *
 * De volgorde van de filters is de volgorde waarin je erover nadenkt: eerst het
 * volume dat de gebruiker koos, dan de fades, dan afsnijden op de duur van de
 * video. Fade-out vóór `atrim` is geen detail — erna zou de fade op muziek
 * vallen die er niet meer is.
 */
export function buildAudioGraph(input: AudioGraphInput): AudioGraph {
  const { settings, trackDurationInSeconds, durationInSeconds, inputIndex, sampleRate } = input;
  const duration = Math.max(durationInSeconds, 0.1);

  // Een nummer dat korter is dan de video wordt herhaald. `-stream_loop` doet
  // dat op de invoer en niet in een filter: zo hoeft er niets van het bestand
  // in het geheugen te blijven staan.
  const loops = trackDurationInSeconds !== null && trackDurationInSeconds < duration;
  const inputArgs = loops ? ["-stream_loop", "-1", "-i", input.trackPath] : ["-i", input.trackPath];

  const fadeIn = clamp(settings.fadeInSeconds, 0, duration / 2);
  const fadeOut = clamp(settings.fadeOutSeconds, 0, duration / 2);

  const filters = [`volume=${clamp(settings.volume, 0, 1).toFixed(3)}`];

  if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn.toFixed(3)}`);
  if (fadeOut > 0) {
    filters.push(`afade=t=out:st=${(duration - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`);
  }

  filters.push(
    // Loopt het nummer toch te kort — het loopt niet en is korter dan de video —
    // dan vult `apad` het aan met stilte in plaats van de video af te kappen.
    "apad",
    `atrim=0:${duration.toFixed(3)}`,
    // Tijdstempels terug naar nul: na `atrim` begint het spoor anders op de
    // tijd waar het geknipt is en loopt het uit de pas met het beeld.
    "asetpts=N/SR/TB",
    `aresample=${sampleRate}`,
  );

  return {
    inputArgs,
    step: `[${inputIndex}:a]${filters.join(",")}[aout]`,
    label: "aout",
  };
}

/**
 * De voice-over (`duckUnderVoiceover`) zit nog niet in het renderplan: er is in
 * de editor nog geen spoor om in te spreken. Zodra dat er is, komt hier een
 * tweede invoer bij met `sidechaincompress` ertussen — de muziek als hoofdspoor,
 * de stem als stuursignaal. De instelling bestaat al, zodat de vorm klopt.
 */
export function supportsDucking(): boolean {
  return false;
}

export function findTrackForPlan(trackId: ID | null): AudioTrack | null {
  return findAudioTrack(trackId);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;

  return Math.min(Math.max(value, min), max);
}
