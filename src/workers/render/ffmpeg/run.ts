import { spawn } from "node:child_process";
import { RenderError } from "@/lib/render/errors";
import { ffmpegPath, ffprobePath, isRenderDryRun } from "@/workers/config";
import type { Logger } from "@/workers/logger";
import type { RenderStageId } from "@/types";

/**
 * FFmpeg starten, volgen en netjes laten stoppen.
 *
 * Eén plek waar een proces begint, zodat drie dingen overal hetzelfde werken:
 *
 * 1. **Voortgang.** `-progress pipe:1` laat FFmpeg elke seconde het aantal
 *    verwerkte frames op stdout zetten. Delen door het aantal frames dat we
 *    verwachten geeft een percentage dat ergens op slaat — geen balk die
 *    vooruit kruipt op een timer.
 * 2. **Afbreken.** Een geannuleerde of afgesloten render moet het proces
 *    meenemen. Zonder dat blijft er een FFmpeg draaien die niemand meer volgt
 *    en die de schijf verder vult.
 * 3. **Fouten die iets zeggen.** FFmpeg schrijft de echte reden op de laatste
 *    regels van stderr. Die bewaren we en zetten we in de `detail` van de
 *    `RenderError`, want "exit code 1" is geen foutmelding.
 */

export type FfmpegRunOptions = {
  /** Alles ná de binary zelf. */
  args: string[];
  /** Komt in de logs en in de foutmelding: `scène 3`, `stitch`. */
  label: string;
  stage: RenderStageId;
  signal: AbortSignal;
  log: Logger;
  /** Verwacht aantal frames; zonder dit getal is er geen voortgang te melden. */
  totalFrames?: number;
  onProgress?: (fraction: number) => void;
};

/** Zoveel regels stderr houden we bij. Genoeg voor de oorzaak, kort genoeg voor een log. */
const STDERR_LINES = 12;

export async function runFfmpeg(options: FfmpegRunOptions): Promise<void> {
  const { args, label, stage, signal, log, totalFrames, onProgress } = options;

  // `-nostdin` want een worker heeft geen toetsenbord: zonder dit blijft FFmpeg
  // bij een bestaand uitvoerbestand op een antwoord staan wachten.
  // `-progress pipe:1` en `-nostats` samen: machineleesbaar op stdout, niets op
  // stderr behalve echte fouten.
  // Alle globale opties vooraan: FFmpeg leest de opdrachtregel in groepen per
  // in- en uitvoerbestand, en wat na de uitvoer staat hoort bij een volgend
  // bestand dat er niet is.
  const full = [
    "-hide_banner",
    "-nostdin",
    "-loglevel",
    "error",
    "-nostats",
    "-progress",
    "pipe:1",
    "-y",
    ...args,
  ];

  log.debug(`FFmpeg: ${label}`, { command: `${ffmpegPath()} ${full.join(" ")}`.slice(0, 4000) });

  if (isRenderDryRun()) {
    onProgress?.(1);

    return;
  }

  if (signal.aborted) throw new RenderError("cancelled", { stage });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath(), full, { stdio: ["ignore", "pipe", "pipe"] });
    const errorLines: string[] = [];
    let settled = false;

    const abort = () => {
      // SIGTERM laat FFmpeg zijn bestanden sluiten; de werkmap wordt daarna
      // toch weggegooid, maar een half bestand met een open handle niet.
      child.kill("SIGTERM");
    };

    signal.addEventListener("abort", abort, { once: true });

    const finish = (error?: RenderError) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);

      if (error) reject(error);
      else resolve();
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const fraction = readProgress(chunk, totalFrames);

      if (fraction !== null) onProgress?.(fraction);
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (!line.trim()) continue;

        errorLines.push(line.trim());
        if (errorLines.length > STDERR_LINES) errorLines.shift();
      }
    });

    child.on("error", (error) => {
      // Meestal ENOENT: de binary staat niet in PATH. Opnieuw proberen lost dat
      // niet op, dus `ffmpeg` en niet `unknown` — die laatste is wel retryable.
      finish(
        new RenderError("ffmpeg", {
          stage,
          detail: `FFmpeg kon niet gestart worden (${ffmpegPath()}): ${error.message}`,
          cause: error,
        }),
      );
    });

    child.on("close", (code, signalName) => {
      if (signal.aborted || signalName) {
        finish(new RenderError("cancelled", { stage, detail: `${label} is onderbroken.` }));

        return;
      }

      if (code !== 0) {
        finish(
          new RenderError("ffmpeg", {
            stage,
            detail: `FFmpeg stopte met code ${code} bij ${label}: ${errorLines.join(" | ") || "geen uitvoer op stderr"}`,
          }),
        );

        return;
      }

      onProgress?.(1);
      finish();
    });
  });
}

/**
 * De voortgangsblokken van FFmpeg zien er zo uit:
 *
 * ```
 * frame=42
 * fps=31.0
 * out_time_us=1400000
 * progress=continue
 * ```
 *
 * `frame` is de bruikbaarste teller: we weten vooraf precies hoeveel frames een
 * clip krijgt, want dat is de duur maal de framerate.
 */
function readProgress(chunk: string, totalFrames: number | undefined): number | null {
  if (!totalFrames || totalFrames <= 0) return null;

  let frame: number | null = null;

  for (const line of chunk.split(/\r?\n/)) {
    const [key, value] = line.split("=");

    if (key === "frame") {
      const parsed = Number.parseInt(value ?? "", 10);
      if (Number.isFinite(parsed)) frame = parsed;
    }

    // Het laatste blok van een geslaagde run; daarna komt er niets meer.
    if (line === "progress=end") return 1;
  }

  if (frame === null) return null;

  return Math.min(frame / totalFrames, 1);
}

/* -------------------------------------------------------------------------
 * ffprobe
 * ---------------------------------------------------------------------- */

export type ProbeResult = {
  width: number | null;
  height: number | null;
  durationInSeconds: number | null;
};

/**
 * Wat er in een bestand zit. Wordt gebruikt om te weten of de muziek moet
 * loopen en om te controleren dat een foto ook echt een foto is; een mislukte
 * probe is geen reden om de render te laten vallen, dus alles mag `null` zijn.
 */
export async function probe(path: string): Promise<ProbeResult> {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-show_entries",
    "stream=width,height:format=duration",
    "-of",
    "json",
    path,
  ];

  const output = await new Promise<string | null>((resolve) => {
    const child = spawn(ffprobePath(), args, { stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code === 0 ? stdout : null));
  });

  if (!output) return { width: null, height: null, durationInSeconds: null };

  try {
    const parsed = JSON.parse(output) as {
      streams?: { width?: number; height?: number }[];
      format?: { duration?: string };
    };
    const stream = parsed.streams?.find((entry) => entry.width && entry.height);
    const duration = Number.parseFloat(parsed.format?.duration ?? "");

    return {
      width: stream?.width ?? null,
      height: stream?.height ?? null,
      durationInSeconds: Number.isFinite(duration) ? duration : null,
    };
  } catch {
    return { width: null, height: null, durationInSeconds: null };
  }
}
