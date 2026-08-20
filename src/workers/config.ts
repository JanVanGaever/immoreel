/**
 * Alles wat de wachtrij uit de omgeving haalt, op één plek.
 *
 * De worker draait als eigen proces, vaak op een andere machine dan de app.
 * Wie wil weten wat je moet zetten om hem te laten draaien, hoeft daarvoor
 * geen drie bestanden open te doen.
 */

/** Naam van de wachtrij in Redis. Verandert dit, dan is een lopende wachtrij verweesd. */
export const RENDER_QUEUE_NAME = "render";

/** Alle sleutels van dit project onder één voorvoegsel; zo kan Redis gedeeld worden. */
export function queuePrefix(): string {
  return process.env.QUEUE_PREFIX ?? "immoreel";
}

export function isQueueConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export function getRedisUrl(): string {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error("REDIS_URL ontbreekt. Zie .env.example.");
  }

  return url;
}

/**
 * Hoeveel renders één worker tegelijk aankan.
 *
 * FFmpeg gebruikt zelf al alle kernen die het krijgt, dus dit getal hoger
 * zetten dan een stuk of twee maakt renders vooral trager in plaats van
 * talrijker. Schalen doe je met meer workerprocessen, niet met meer
 * gelijktijdige jobs per proces.
 */
export function workerConcurrency(): number {
  return positiveInt(process.env.RENDER_WORKER_CONCURRENCY, 2);
}

/** Aantal pogingen per job, inclusief de eerste. */
export function jobAttempts(): number {
  return positiveInt(process.env.RENDER_JOB_ATTEMPTS, 3);
}

/**
 * Hoe lang een worker de job vasthoudt zonder teken van leven. Renderen is
 * traag; met de standaard van 30 seconden zou BullMQ een gezonde job als
 * vastgelopen bestempelen en een tweede worker erop zetten.
 */
export function lockDurationMs(): number {
  return positiveInt(process.env.RENDER_LOCK_SECONDS, 300) * 1000;
}

/** Waar tijdelijke bestanden tijdens een render staan. */
export function workDir(): string {
  return process.env.RENDER_WORK_DIR ?? "./.render";
}

/** Pad naar de FFmpeg-binary; leeg betekent: wat in PATH staat. */
export function ffmpegPath(): string {
  return process.env.FFMPEG_PATH ?? "ffmpeg";
}

/**
 * Draait de worker mee in het proces van de webserver? Alleen voor ontwikkelen:
 * zolang de stores in het geheugen zitten, ziet een los workerproces de
 * projecten van de app niet.
 */
export function isInlineWorkerEnabled(): boolean {
  return process.env.RENDER_WORKER_INLINE === "1";
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/* -------------------------------------------------------------------------
 * FFmpeg
 * ---------------------------------------------------------------------- */

/** Pad naar ffprobe; standaard naast FFmpeg zelf. */
export function ffprobePath(): string {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;

  // `ffmpeg` -> `ffprobe`, ook als er een volledig pad staat: de twee binaries
  // horen bij elkaar en staan zo goed als altijd in dezelfde map.
  const ffmpeg = ffmpegPath();

  return ffmpeg.replace(/ffmpeg(\.exe)?$/i, (match) => match.replace(/ffmpeg/i, "ffprobe"));
}

/**
 * Hoeveel groter de foto gemaakt wordt vóór `zoompan` erop werkt.
 *
 * `zoompan` legt zijn uitsnede op hele pixels van het *invoerbeeld*. Op een
 * foto die al op uitvoerformaat staat, verspringt die uitsnede daardoor met
 * hele pixels tegelijk en trilt een trage zoom zichtbaar. Twee keer zo groot
 * invoeren halveert die stap en dat is genoeg; vier keer kost vier keer zoveel
 * geheugen voor een verschil dat niemand ziet.
 */
export function zoompanSupersample(): number {
  return clampNumber(process.env.RENDER_ZOOMPAN_SUPERSAMPLE, 1, 4, 2);
}

/**
 * Wat er gebeurt als de foto een andere verhouding heeft dan de export:
 * `cover` snijdt bij (standaard), `contain` legt de hele foto op een vlak.
 */
export function renderFit(): "cover" | "contain" {
  return process.env.RENDER_FIT === "contain" ? "contain" : "cover";
}

/** Vulkleur bij `contain`, als FFmpeg-kleur (`black`, `0x101828`, ...). */
export function renderPadColor(): string {
  return process.env.RENDER_PAD_COLOR ?? "black";
}

/**
 * Lettertype voor de intro-, contact- en logotekst. Zonder dit bestand kan
 * `drawtext` niets tekenen; de kaarten worden dan vlakken zonder tekst in
 * plaats van dat de hele render stukloopt.
 */
export function renderFontPath(): string | null {
  return process.env.RENDER_FONT_PATH || null;
}

/** Map met de muziekbestanden van de catalogus (`trk_warme_gitaar.mp3`, ...). */
export function audioLibraryDir(): string | null {
  return process.env.RENDER_AUDIO_DIR || null;
}

/** Map waar de foto's staan zolang er geen object storage is. */
export function assetSourceDir(): string | null {
  return process.env.RENDER_ASSET_DIR || null;
}

/** Basis-URL om een foto op te halen: `${basis}/${assetId}`. */
export function assetBaseUrl(): string | null {
  return process.env.RENDER_ASSET_BASE_URL || null;
}

/**
 * Logt de FFmpeg-commando's zonder ze uit te voeren. Bedoeld om een
 * filtergraaf te bekijken zonder dat er een minuut gerenderd wordt.
 */
export function isRenderDryRun(): boolean {
  return process.env.RENDER_DRY_RUN === "1";
}

function clampNumber(
  value: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = Number.parseFloat(value ?? "");

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(parsed, min), max);
}

/**
 * Lager renderen dan de preset vraagt: `1080p`, `720p` of `480p`. Bedoeld voor
 * een testomgeving of een goedkope machine — in productie hoort hier niets te
 * staan, want dan krijgt de gebruiker een ander formaat dan hij koos.
 */
export function renderResolutionVariant(): string {
  return process.env.RENDER_RESOLUTION ?? "preset";
}

/** Framerate die de preset overschrijft; leeg betekent: die van de preset. */
export function renderFpsOverride(): number | null {
  const parsed = Number.parseInt(process.env.RENDER_FPS ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
