import { setTimeout as delay } from "node:timers/promises";
import { stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findBrandKit } from "@/lib/editor/branding";
import type { RenderPlan, ScenePlan } from "@/lib/editor/render-plan";
import type { TransitionId } from "@/lib/editor/templates";
import { RenderError } from "@/lib/render/errors";
import {
  isRenderDryRun,
  renderFit,
  renderFontPath,
  renderPadColor,
  zoompanSupersample,
} from "@/workers/config";
import type { Logger } from "@/workers/logger";
import {
  buildAudioGraph,
  findTrackForPlan,
  getAudioLibrary,
  type AudioGraph,
} from "@/workers/render/ffmpeg/audio";
import {
  buildCardCommand,
  introCardText,
  outroCardText,
  wrapCardText,
} from "@/workers/render/ffmpeg/cards";
import {
  encodingFor,
  resolveTarget,
  type EncodingMode,
  type RenderTarget,
} from "@/workers/render/ffmpeg/config";
import {
  XFADE_BY_TRANSITION,
  describeSceneMotion,
  type LogoOverlay,
} from "@/workers/render/ffmpeg/filters";
import { probe, runFfmpeg } from "@/workers/render/ffmpeg/run";
import { buildSceneCommand } from "@/workers/render/ffmpeg/scene";
import {
  audioInputIndex,
  buildConcatList,
  buildPosterCommand,
  buildStitchCommand,
  stitchDuration,
  stitchMode,
  type StitchClip,
} from "@/workers/render/ffmpeg/stitch";
import type { ID } from "@/types";

/**
 * De poort naar FFmpeg.
 *
 * Alles eromheen — wachtrij, status, voortgang, fouten, opruimen — hoort niet
 * te weten hoe een video gemaakt wordt. Daarom deze drie methodes: scènes
 * renderen, ze aan elkaar plakken en er een posterbeeld uit halen. De echte
 * implementatie staat in `src/workers/render/ffmpeg/`; de nepimplementatie
 * hieronder doet er even lang over en schrijft een bestandje, zodat de hele
 * pijplijn te draaien en te testen is zonder dat FFmpeg geïnstalleerd staat.
 */

export type SceneClip = {
  /** De scène, of `intro`/`outro` voor de kaarten van het template. */
  sceneId: ID;
  /** Pad naar het tussenbestand op schijf. */
  path: string;
  durationInSeconds: number;
  transition: TransitionId;
  /** Overlap met de vorige clip; 0 bij de eerste en bij een harde cut. */
  transitionInSeconds: number;
};

export type RenderOutput = {
  path: string;
  durationInSeconds: number;
  sizeInBytes: number;
};

export type RenderBackendContext = {
  plan: RenderPlan;
  /**
   * De foto van elke scène, op scène-id. Wordt gevuld door de `fetch`-stap van
   * de pijplijn: FFmpeg leest van schijf, niet van een URL.
   */
  assets: Record<ID, string>;
  /** Map waarin tussenbestanden mogen staan. Wordt achteraf opgeruimd. */
  workDir: string;
  signal: AbortSignal;
  log: Logger;
  /** Fractie binnen de huidige stap, van 0 tot 1. */
  onProgress: (fraction: number) => void;
};

export type RenderBackend = {
  readonly name: string;
  /**
   * Of de foto's eerst opgehaald moeten worden. De nepbackend raakt ze niet
   * aan, en dan hoort een ontbrekende bron ook geen render tegen te houden.
   */
  readonly needsAssets: boolean;
  /** Eén clip per foto: de zoompan-beweging uitgerekend tot frames. */
  renderScenes(context: RenderBackendContext): Promise<SceneClip[]>;
  /** De clips aan elkaar met de overgangen, muziek eronder, één bestand eruit. */
  stitch(
    context: RenderBackendContext & { clips: SceneClip[]; outputPath: string },
  ): Promise<RenderOutput>;
  /** Eén beeld uit de afgewerkte video, voor in de projectlijst. */
  poster?(
    context: RenderBackendContext & { videoPath: string; outputPath: string },
  ): Promise<string | null>;
};

/* -------------------------------------------------------------------------
 * De echte backend
 * ---------------------------------------------------------------------- */

/**
 * FFmpeg, in twee slagen.
 *
 * Eerst wordt elke foto een eigen clip: schalen, bijsnijden, `zoompan` erover,
 * coderen. Daarna gaan die clips aan elkaar. Dat het in twee slagen gebeurt is
 * geen omweg maar de reden dat het schaalt — zie `scene.ts` en `stitch.ts`.
 *
 * Wat hier gerenderd wordt, staat volledig vast in het plan. Er wordt niets
 * bijverzonnen, niets geïnterpreteerd en niets gegenereerd: dezelfde foto's met
 * dezelfde instellingen geven twee keer dezelfde video.
 */
export function createFfmpegBackend(): RenderBackend {
  return {
    name: "ffmpeg",
    needsAssets: true,

    async renderScenes({ plan, assets, workDir, signal, log, onProgress }) {
      const target = resolveTarget(plan);
      const encoding = encodingFor(plan.presetId);
      // Wordt er straks toch hergecodeerd, dan mogen de tussenbestanden snel en
      // ruim. Zo niet, dan is dit tussenbestand het eindbestand.
      const mode: EncodingMode = willReencode(plan) ? "tussen" : "eind";
      const logo = buildLogo(plan);

      log.info("Scènes renderen", {
        target: target.size,
        fps: target.fps,
        preset: plan.presetId,
        encoding: `${encoding.videoCodec} crf ${encoding.crf} ${encoding.profile}@${encoding.level}`,
        clipMode: mode,
        logo: logo ? logo.placement : "geen",
      });

      const commands = await planCommands({ plan, assets, workDir, target, encoding, mode, logo });
      const totalFrames = commands.reduce((sum, entry) => sum + entry.frames, 0) || 1;
      const clips: SceneClip[] = [];
      let renderedFrames = 0;

      for (const entry of commands) {
        if (signal.aborted) throw new RenderError("cancelled", { stage: "scenes" });

        log.debug(`Clip ${entry.clip.sceneId}`, { chain: entry.chain.slice(0, 1200) });

        await runFfmpeg({
          args: entry.args,
          label: `clip ${entry.clip.sceneId}`,
          stage: "scenes",
          signal,
          log,
          totalFrames: entry.frames,
          // De voortgang van deze clip telt mee naar rato van haar frames; een
          // scène van vijf seconden weegt zwaarder dan een intro van één.
          onProgress: (fraction) =>
            onProgress((renderedFrames + entry.frames * fraction) / totalFrames),
        });

        renderedFrames += entry.frames;
        clips.push(entry.clip);
        onProgress(renderedFrames / totalFrames);
      }

      return clips;
    },

    async stitch({ plan, clips, outputPath, workDir, signal, log, onProgress }) {
      const target = resolveTarget(plan);
      const encoding = encodingFor(plan.presetId);
      const stitchClips: StitchClip[] = clips.map((clip) => ({
        path: clip.path,
        durationInSeconds: clip.durationInSeconds,
        transition: clip.transition,
        transitionInSeconds: clip.transitionInSeconds,
      }));

      const mode = stitchMode(stitchClips);
      const concatListPath = join(workDir, "clips.txt");

      if (mode === "concat") {
        await writeFile(concatListPath, buildConcatList(stitchClips), "utf8");
      }

      // De muziek wordt op de exacte lengte van de video geknipt, dus die
      // lengte moet bekend zijn vóór de filterketen gebouwd wordt.
      const durationInSeconds = stitchDuration(stitchClips, target.fps);
      const audio = await resolveAudio({
        plan,
        durationInSeconds,
        inputIndex: audioInputIndex(stitchClips),
        sampleRate: encoding.audioSampleRate,
        log,
      });

      const command = buildStitchCommand({
        clips: stitchClips,
        target,
        encoding,
        outputPath,
        concatListPath,
        audio,
      });

      log.info("Clips samenvoegen", {
        mode: command.mode,
        clips: stitchClips.length,
        durationInSeconds: command.durationInSeconds,
        audio: audio ? "muziek" : "geen",
      });

      await runFfmpeg({
        args: command.args,
        label: `stitch (${command.mode})`,
        stage: "stitch",
        signal,
        log,
        totalFrames: command.totalFrames,
        onProgress,
      });

      return {
        path: outputPath,
        durationInSeconds: command.durationInSeconds,
        sizeInBytes: await fileSize(outputPath),
      };
    },

    async poster({ plan, videoPath, outputPath, signal, log }) {
      // Ná de introkaart, zodat het posterbeeld een pand toont en geen vlak in
      // de huisstijl. Duurt de intro langer dan de video, dan valt het terug op
      // het midden.
      const at = Math.min(plan.introSeconds + 0.5, Math.max(plan.durationInSeconds / 2, 0));

      try {
        await runFfmpeg({
          args: buildPosterCommand({ videoPath, outputPath, atSeconds: at }),
          label: "posterframe",
          stage: "publish",
          signal,
          log,
        });

        return isRenderDryRun() ? null : outputPath;
      } catch (error) {
        // Een video zonder posterbeeld is een video; hier de hele render op
        // laten stuklopen zou de verhouding zoek maken.
        log.warn("Geen posterframe gemaakt", { reden: String(error) });

        return null;
      }
    },
  };
}

/* -------------------------------------------------------------------------
 * De opdrachten van één render
 * ---------------------------------------------------------------------- */

type ClipCommand = {
  args: string[];
  frames: number;
  chain: string;
  clip: SceneClip;
};

/**
 * De volledige rij clips: introkaart, elke foto, contactkaart.
 *
 * De kaarten sluiten met een harde cut aan op de rest. Het renderplan rekent
 * hun duur er ook zo bij op (`introSeconds + beeld + outroSeconds`), en een
 * video die korter uitvalt dan wat de editor toonde is verwarrender dan een
 * intro zonder overvloeier.
 */
async function planCommands(input: {
  plan: RenderPlan;
  assets: Record<ID, string>;
  workDir: string;
  target: RenderTarget;
  encoding: ReturnType<typeof encodingFor>;
  mode: EncodingMode;
  logo: LogoOverlay | null;
}): Promise<ClipCommand[]> {
  const { plan, assets, workDir, target, encoding, mode, logo } = input;
  const commands: ClipCommand[] = [];
  const fontPath = renderFontPath();

  if (plan.introSeconds > 0) {
    commands.push(
      await cardCommand({
        kind: "intro",
        text: introCardText(plan),
        seconds: plan.introSeconds,
        plan,
        workDir,
        target,
        encoding,
        mode,
        fontPath,
      }),
    );
  }

  for (const scene of plan.scenes) {
    const imagePath = assets[scene.sceneId];

    if (!imagePath) {
      throw new RenderError("assets-missing", {
        stage: "scenes",
        detail: `Scène ${scene.sceneId} heeft geen foto in de werkmap.`,
      });
    }

    const command = buildSceneCommand({
      scene,
      imagePath,
      outputPath: clipPath(workDir, scene.order, plan.container),
      target,
      encoding,
      mode,
      filters: {
        fit: renderFit(),
        padColor: renderPadColor(),
        supersample: zoompanSupersample(),
        logo,
      },
    });

    commands.push({
      args: command.args,
      frames: command.frames,
      chain: `${describeSceneMotion(scene.motion)} => ${command.chain}`,
      clip: {
        sceneId: scene.sceneId,
        path: clipPath(workDir, scene.order, plan.container),
        durationInSeconds: command.durationInSeconds,
        transition: scene.transition,
        transitionInSeconds: scene.transitionInSeconds,
      },
    });
  }

  if (plan.outroSeconds > 0) {
    commands.push(
      await cardCommand({
        kind: "outro",
        text: outroCardText(plan),
        seconds: plan.outroSeconds,
        plan,
        workDir,
        target,
        encoding,
        mode,
        fontPath,
      }),
    );
  }

  return commands;
}

async function cardCommand(input: {
  kind: "intro" | "outro";
  text: string | null;
  seconds: number;
  plan: RenderPlan;
  workDir: string;
  target: RenderTarget;
  encoding: ReturnType<typeof encodingFor>;
  mode: EncodingMode;
  fontPath: string | null;
}): Promise<ClipCommand> {
  const outputPath = join(input.workDir, `card-${input.kind}.${input.plan.container}`);
  let textFilePath: string | null = null;

  if (input.text && input.fontPath) {
    // De tekst gaat via een bestand de filter in; zie `textCardFilters`. Het
    // afbreken gebeurt hier en niet in FFmpeg, want `drawtext` doet dat niet.
    textFilePath = join(input.workDir, `${input.kind}.txt`);
    await writeFile(textFilePath, wrapCardText(input.text, input.kind, input.target), "utf8");
  }

  const command = buildCardCommand({
    kind: input.kind,
    plan: input.plan,
    target: input.target,
    encoding: input.encoding,
    mode: input.mode,
    durationInSeconds: input.seconds,
    outputPath,
    textFilePath,
    fontPath: input.fontPath,
  });

  return {
    args: command.args,
    frames: command.frames,
    chain: command.chain,
    clip: {
      sceneId: input.kind,
      path: outputPath,
      durationInSeconds: command.durationInSeconds,
      transition: "hard",
      transitionInSeconds: 0,
    },
  };
}

/**
 * Zit er een zachte overgang in het plan? Zo niet, dan worden de clips straks
 * zonder hercodering aan elkaar geplakt en moeten ze meteen op de instellingen
 * van het platform staan.
 */
function willReencode(plan: RenderPlan): boolean {
  return plan.scenes.some(
    (scene) => scene.transitionInSeconds > 0 && XFADE_BY_TRANSITION[scene.transition] !== null,
  );
}

function buildLogo(plan: RenderPlan): LogoOverlay | null {
  const fontPath = renderFontPath();
  const kit = findBrandKit(plan.branding.brandKitId);

  if (!fontPath || !kit || plan.branding.logoPlacement === "geen") return null;

  return {
    initials: kit.logoInitials,
    placement: plan.branding.logoPlacement,
    // Wit met een schaduw blijft leesbaar op een lichte gevel én in een donkere
    // living; de accentkleur van de kit doet dat niet.
    color: "white",
    fontPath,
  };
}

async function resolveAudio(input: {
  plan: RenderPlan;
  durationInSeconds: number;
  inputIndex: number;
  sampleRate: number;
  log: Logger;
}): Promise<AudioGraph | null> {
  const { plan, log } = input;
  const track = findTrackForPlan(plan.audio.trackId);

  if (!track) return null;

  const library = getAudioLibrary();
  const trackPath = library ? await library.find(track.id) : null;

  if (!trackPath) {
    // Geen reden om de render te laten mislukken: het beeld klopt, alleen de
    // muziek ontbreekt. Wel iets om terug te vinden in de logs.
    log.warn("Muziek niet gevonden; de video wordt zonder geluid gerenderd", {
      trackId: track.id,
      library: library?.name ?? "geen",
    });

    return null;
  }

  // De catalogus draagt een lengte mee, maar het bestand is de waarheid: of er
  // geloopt moet worden, hangt aan wat er echt op schijf staat.
  const measured = await probe(trackPath);

  return buildAudioGraph({
    settings: plan.audio,
    trackDurationInSeconds: measured.durationInSeconds ?? track.durationInSeconds,
    trackPath,
    durationInSeconds: input.durationInSeconds,
    inputIndex: input.inputIndex,
    sampleRate: input.sampleRate,
  });
}

function clipPath(workDir: string, order: number, container: string): string {
  return join(workDir, `scene-${String(order).padStart(3, "0")}.${container}`);
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    // In een dry run bestaat het bestand niet; dat is geen fout.
    return 0;
  }
}

/* -------------------------------------------------------------------------
 * De nepbackend
 * ---------------------------------------------------------------------- */

/**
 * Rendert niets, maar neemt er wel de tijd voor, evenredig met de duur van de
 * scène. Zelfde idee als `createFakeTransport` bij de uploads: het scherm en de
 * pijplijn zijn er compleet mee te gebruiken zolang FFmpeg er niet is.
 */
export function createFakeBackend(options: { secondsPerSecond?: number } = {}): RenderBackend {
  // Een render duurt ruwweg een derde van de speelduur; traag genoeg om
  // voortgang te zien, snel genoeg om niet op te wachten.
  const { secondsPerSecond = 3 } = options;

  return {
    name: "fake",
    needsAssets: false,

    async renderScenes({ plan, workDir, signal, onProgress }) {
      const clips: SceneClip[] = [];
      const total = plan.scenes.reduce((sum, scene) => sum + scene.durationInSeconds, 0) || 1;
      let done = 0;

      for (const scene of plan.scenes) {
        await sleep((scene.durationInSeconds / secondsPerSecond) * 1000, signal);

        const path = `${workDir}/scene-${scene.order}.txt`;
        await writeFile(path, describeScene(scene), "utf8");
        clips.push({
          sceneId: scene.sceneId,
          path,
          durationInSeconds: scene.durationInSeconds,
          transition: scene.transition,
          transitionInSeconds: scene.transitionInSeconds,
        });

        done += scene.durationInSeconds;
        onProgress(done / total);
      }

      return clips;
    },

    async stitch({ plan, clips, outputPath, signal, onProgress }) {
      const steps = Math.max(clips.length, 1);

      for (let index = 0; index < steps; index += 1) {
        await sleep(400, signal);
        onProgress((index + 1) / steps);
      }

      const body = clips.map((clip) => clip.path).join("\n");
      await writeFile(outputPath, `${body}\n`, "utf8");

      return {
        path: outputPath,
        durationInSeconds: plan.durationInSeconds,
        sizeInBytes: Buffer.byteLength(body),
      };
    },
  };
}

/**
 * Welke backend er draait. Zonder `RENDER_BACKEND=ffmpeg` blijft het bij de
 * nepversie — beter een render die zichtbaar niets doet dan een worker die bij
 * elke job stukloopt op een ontbrekende binary.
 */
export function getRenderBackend(): RenderBackend {
  return process.env.RENDER_BACKEND === "ffmpeg" ? createFfmpegBackend() : createFakeBackend();
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  try {
    await delay(ms, undefined, { signal });
  } catch {
    // `delay` gooit een AbortError; als renderfout leest dat een stuk beter.
    throw new RenderError("cancelled", { detail: "De render is onderbroken." });
  }
}

function describeScene(scene: ScenePlan): string {
  return [
    `scene ${scene.order}`,
    `asset ${scene.assetId ?? "-"}`,
    `frames ${scene.frames}`,
    `zoompan ${scene.zoompan.filter}`,
  ].join("\n");
}
