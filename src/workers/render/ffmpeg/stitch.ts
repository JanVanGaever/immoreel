import type { EncodingProfile, RenderTarget } from "@/workers/render/ffmpeg/config";
import { audioEncodingArgs, videoEncodingArgs } from "@/workers/render/ffmpeg/config";
import type { AudioGraph } from "@/workers/render/ffmpeg/audio";
import {
  XFADE_BY_TRANSITION,
  buildJoinGraph,
  concatListEntry,
  type ClipTiming,
} from "@/workers/render/ffmpeg/filters";

/**
 * De clips aan elkaar, met de muziek eronder.
 *
 * Er zijn twee wegen, en welke het wordt hangt af van de overgangen:
 *
 * - **Alleen harde cuts.** Dan hoeft er aan het beeld niets te veranderen: de
 *   concat-demuxer plakt de clips achter elkaar en `-c:v copy` schrijft ze
 *   letterlijk over. Dat is bijna gratis, en de kwaliteit is exact die van de
 *   clips — geen tweede compressieronde.
 * - **Eén zachte overgang of meer.** Dan moeten beelden door elkaar lopen en
 *   wordt er hoe dan ook opnieuw gecodeerd; alle clips gaan als aparte invoer
 *   in één filterketen, waarin de zachte overgangen een `xfade` worden en de
 *   harde cuts een `concat` (zie `buildJoinGraph`).
 *
 * De muziek verandert die keuze niet: audio hoort er in beide gevallen los bij,
 * dus een video zonder overgangen blijft ook mét muziek een kopieerslag.
 */

export type StitchClip = ClipTiming & { path: string };

export type StitchMode = "concat" | "xfade";

export type StitchCommandInput = {
  clips: StitchClip[];
  target: RenderTarget;
  encoding: EncodingProfile;
  outputPath: string;
  /** Pad naar het lijstbestand; alleen nodig in `concat`-modus. */
  concatListPath: string;
  /** `null` als er geen muziek is. */
  audio: AudioGraph | null;
};

export type StitchCommand = {
  args: string[];
  mode: StitchMode;
  durationInSeconds: number;
  /** Voor de voortgangsbalk: hoeveel frames er uit deze stap komen. */
  totalFrames: number;
};

/** Kan het beeld ongewijzigd doorgeschreven worden? */
export function stitchMode(clips: StitchClip[]): StitchMode {
  if (clips.length <= 1) return "concat";

  const soft = clips
    .slice(1)
    .some((clip) => clip.transitionInSeconds > 0 && XFADE_BY_TRANSITION[clip.transition] !== null);

  return soft ? "xfade" : "concat";
}

/**
 * Hoe lang de video wordt.
 *
 * Apart van `buildStitchCommand`, want de muziek moet op deze lengte geknipt
 * worden en die keten wordt gebouwd vóór het commando bestaat. Beide gebruiken
 * dezelfde berekening, dus ze kunnen niet uit elkaar lopen.
 */
export function stitchDuration(clips: StitchClip[], fps: number): number {
  if (stitchMode(clips) === "concat") {
    const total = clips.reduce((sum, clip) => sum + clip.durationInSeconds, 0);

    return Math.round(total * 1000) / 1000;
  }

  return buildJoinGraph(clips, fps).durationInSeconds;
}

/** De inhoud van het lijstbestand voor de concat-demuxer. */
export function buildConcatList(clips: StitchClip[]): string {
  return `${clips.map((clip) => concatListEntry(clip.path)).join("\n")}\n`;
}

/**
 * De index van de muziek tussen de `-i`-argumenten. In `concat`-modus is de
 * lijst invoer 0 en de muziek dus 1; in `xfade`-modus komt ze na alle clips.
 * De filterketen verwijst met dat nummer naar het spoor, dus het moet kloppen
 * vóór de keten gebouwd wordt.
 */
export function audioInputIndex(clips: StitchClip[]): number {
  return stitchMode(clips) === "concat" ? 1 : clips.length;
}

export function buildStitchCommand(input: StitchCommandInput): StitchCommand {
  const { clips, target, encoding, audio } = input;
  const mode = stitchMode(clips);

  return mode === "concat" ? concatCommand(input) : xfadeCommand(input, target, encoding, audio);
}

function concatCommand(input: StitchCommandInput): StitchCommand {
  const { clips, target, encoding, audio } = input;
  const duration = clips.reduce((total, clip) => total + clip.durationInSeconds, 0);

  const args = [
    // `-safe 0` omdat de paden absoluut zijn; zonder die vlag weigert de
    // demuxer alles wat niet relatief naast het lijstbestand staat.
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    input.concatListPath,
    ...(audio?.inputArgs ?? []),
  ];

  if (audio) {
    args.push("-filter_complex", audio.step, "-map", "0:v", "-map", `[${audio.label}]`);
  } else {
    args.push("-map", "0:v", "-an");
  }

  args.push(
    // Het beeld is al precies wat het moet zijn; alleen de container wordt
    // opnieuw geschreven.
    "-c:v",
    "copy",
    ...(audio ? audioEncodingArgs(encoding, target) : []),
    ...encoding.extraArgs,
    input.outputPath,
  );

  return {
    args,
    mode: "concat",
    durationInSeconds: Math.round(duration * 1000) / 1000,
    totalFrames: Math.max(Math.round(duration * target.fps), 1),
  };
}

function xfadeCommand(
  input: StitchCommandInput,
  target: RenderTarget,
  encoding: EncodingProfile,
  audio: AudioGraph | null,
): StitchCommand {
  const { clips } = input;
  const graph = buildJoinGraph(clips, target.fps);

  const args = clips.flatMap((clip) => ["-i", clip.path]);
  if (audio) args.push(...audio.inputArgs);

  // Video- en audiotakken staan in dezelfde graaf, gescheiden door `;`.
  const steps = [...graph.steps];
  if (audio) steps.push(audio.step);

  args.push("-filter_complex", steps.join(";"));
  args.push("-map", `[${graph.label}]`);

  if (audio) args.push("-map", `[${audio.label}]`);
  else args.push("-an");

  args.push(
    ...videoEncodingArgs(encoding, target, "eind"),
    ...(audio ? audioEncodingArgs(encoding, target) : []),
    input.outputPath,
  );

  return {
    args,
    mode: "xfade",
    durationInSeconds: graph.durationInSeconds,
    totalFrames: Math.max(Math.round(graph.durationInSeconds * target.fps), 1),
  };
}

/**
 * Het posterframe: één beeld uit de afgewerkte video.
 *
 * Niet uit de eerste foto maar uit de video zelf, en niet op tijdstip nul: daar
 * staat de introkaart, en een projectlijst vol gekleurde vlakken helpt niemand.
 * Even later staat het eerste pand in beeld.
 */
export function buildPosterCommand(input: {
  videoPath: string;
  outputPath: string;
  atSeconds: number;
}): string[] {
  return [
    // `-ss` vóór `-i` zoekt in plaats van te decoderen: op een lange video
    // scheelt dat seconden, en preciezer dan een frame hoeft het niet.
    "-ss",
    input.atSeconds.toFixed(3),
    "-i",
    input.videoPath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    input.outputPath,
  ];
}
