import type { ScenePlan } from "@/lib/editor/render-plan";
import type { EncodingMode, EncodingProfile, RenderTarget } from "@/workers/render/ffmpeg/config";
import { videoEncodingArgs } from "@/workers/render/ffmpeg/config";
import { buildSceneFilters, type SceneFilterOptions } from "@/workers/render/ffmpeg/filters";

/**
 * Eén foto wordt één clip.
 *
 * Waarom per scène een eigen bestand en niet alles in één opdracht: een
 * filtergraaf met veertig `zoompan`-takken erin houdt veertig gedecodeerde
 * foto's tegelijk in het geheugen en is bij een fout niet te lezen. Los
 * gerenderd is elke clip apart te bekijken, kost een mislukte scène niet de
 * hele render, en weet de voortgangsbalk precies waar hij staat.
 */

export type SceneCommand = {
  /** De argumenten voor FFmpeg, zonder de binary zelf. */
  args: string[];
  /** Aantal frames dat deze clip krijgt; de voortgang telt hiernaartoe. */
  frames: number;
  durationInSeconds: number;
  /** De filterketen apart, om te loggen. */
  chain: string;
};

export type SceneCommandInput = {
  scene: ScenePlan;
  /** De foto in de werkmap. */
  imagePath: string;
  outputPath: string;
  target: RenderTarget;
  encoding: EncodingProfile;
  mode: EncodingMode;
  filters: Omit<SceneFilterOptions, "target">;
};

export function buildSceneCommand(input: SceneCommandInput): SceneCommand {
  const { scene, target, encoding, mode } = input;
  const filters = buildSceneFilters(scene, { ...input.filters, target });

  const args = [
    // `-loop 1` maakt van één foto een oneindige videostroom; `-framerate` zet
    // meteen het ritme, zodat er niets bijgeschat hoeft te worden.
    "-loop",
    "1",
    "-framerate",
    String(target.fps),
    "-i",
    input.imagePath,
    "-vf",
    filters.chain,
    // Niet `-t`: het aantal frames is de duur maal de framerate, en dat willen
    // we exact. Op een halve seconde en 30 fps scheelt afronden anders een
    // frame, en die verschuiving stapelt op over veertig scènes.
    "-frames:v",
    String(filters.frames),
    "-an",
    ...videoEncodingArgs(encoding, target, mode),
    input.outputPath,
  ];

  return {
    args,
    frames: filters.frames,
    durationInSeconds: scene.durationInSeconds,
    chain: filters.chain,
  };
}
