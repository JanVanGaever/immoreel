import {
  buildExportFileNames,
  describeFormat,
  estimateFileSizeInBytes,
  EXPORT_PRESETS,
  exportPlatformLabel,
  findExportPreset,
  slugify,
} from "@/lib/editor/export-presets";
import { describeProgress, isTerminalStatus } from "@/lib/render/status";
import type {
  AspectRatio,
  ExportPreset,
  ID,
  RenderErrorCode,
  RenderJobSnapshot,
  RenderJobStatus,
  RenderStageId,
} from "@/types";

/**
 * Wat er op de downloadpagina staat.
 *
 * De regel van deze module: één functie, twee kanten. De server bouwt de
 * beginstand uit de renderjobs, de browser bouwt hem opnieuw zodra er een
 * snapshot binnenkomt — met exact deze code. Zou de client zijn eigen
 * samenvoeglogica hebben, dan zou een kaart na een live update net iets anders
 * kunnen tonen dan na een herlaadpagina, en dat is precies het soort verschil
 * waar niemand ooit een bugrapport voor schrijft maar iedereen het vertrouwen
 * in de pagina door verliest.
 *
 * Alles hier is puur: geen fetch, geen store, geen `Date.now()`.
 */

/** Eén kaart op de pagina: de laatste render voor één exportformaat. */
export type ExportResult = {
  jobId: ID;
  presetId: ID;
  /** "Instagram Reels — 9:16", of een noodnaam als de preset verdwenen is. */
  label: string;
  platformLabel: string;
  /** `null` wanneer de preset niet meer in de catalogus staat. */
  preset: ExportPreset | null;
  /** De naam waaronder dit bestand in de downloadmap komt. */
  fileName: string;
  metadata: ExportMetadata | null;
  status: RenderJobStatus;
  stage: RenderStageId | null;
  /** 0 tot 100. */
  progress: number;
  /** De zin bij de huidige stand: "Scènes renderen". */
  message: string;
  error: { code: RenderErrorCode; message: string; retryable: boolean } | null;
  /** Gemeten grootte; pas bekend zodra de render klaar is. */
  sizeInBytes: number | null;
  /** Schatting zolang er nog gerenderd wordt; een plafond, geen belofte. */
  estimatedSizeInBytes: number | null;
  durationInSeconds: number | null;
  isDownloadable: boolean;
  /** Of er een posterbeeld te tonen valt. */
  hasPoster: boolean;
  queuedAt: string;
  finishedAt: string | null;
};

/** De technische kant van één export, zoals ze op de kaart staat. */
export type ExportMetadata = {
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  fps: number;
  container: string;
  /** "1080x1920 · 30 fps · 6 Mbit/s". */
  summary: string;
  videoBitrateKbps: number;
};

/** De stand van de hele batch: wat de balk bovenaan de pagina toont. */
export type ExportOverview = {
  total: number;
  done: number;
  failed: number;
  /** In wachtrij, aan het renderen of aan het afwerken. */
  busy: number;
  /** Gemiddelde voortgang over alle exports, 0 tot 100. */
  progress: number;
  /** Alles klaar én minstens één export: dan pas is er iets om te vieren. */
  allDone: boolean;
  /** Er is niets meer onderweg; klaar of mislukt, maar het ligt stil. */
  isSettled: boolean;
  downloadableCount: number;
  /** Som van wat er te downloaden valt; alleen gemeten groottes. */
  downloadableSizeInBytes: number;
  /** Mislukte exports die opnieuw geprobeerd kunnen worden. */
  retryablePresetIds: ID[];
};

/** Wat de bestandsnaam en de schatting nodig hebben van het project. */
export type ExportProjectContext = {
  title: string;
  durationInSeconds: number;
  reference?: string | null;
  city?: string | null;
};

/** Volgorde in de catalogus; die bepaalt ook de volgorde op de pagina. */
const PRESET_ORDER = new Map<ID, number>(EXPORT_PRESETS.map((preset, index) => [preset.id, index]));

/**
 * Per exportformaat de meest recente job.
 *
 * Een tweede poging na een fout — of na een wijziging in de montage — is een
 * nieuwe job met een nieuwe id, maar voor de gebruiker is het dezelfde export
 * naar hetzelfde platform. Twee kaarten voor "Instagram Reels" waarvan er één
 * mislukt is en één loopt, zou alleen maar de vraag oproepen welke van de twee
 * nu telt.
 */
function latestPerPreset(snapshots: readonly RenderJobSnapshot[]): RenderJobSnapshot[] {
  const byPreset = new Map<ID, RenderJobSnapshot>();

  for (const snapshot of snapshots) {
    // De terugvalsnapshot uit de eventstroom heeft geen preset (zie de
    // stream-route); die kan geen kaart dragen.
    if (!snapshot.presetId) continue;

    const current = byPreset.get(snapshot.presetId);

    if (!current || isNewer(snapshot, current)) byPreset.set(snapshot.presetId, snapshot);
  }

  return [...byPreset.values()];
}

/**
 * `queuedAt` beslist, want dat is het moment waarop de opdracht gegeven is.
 * Bij gelijkspel — twee jobs in dezelfde milliseconde ingestuurd — wint wie
 * het laatst iets van zich liet horen.
 */
function isNewer(candidate: RenderJobSnapshot, current: RenderJobSnapshot): boolean {
  if (candidate.jobId === current.jobId) return true;

  const byQueue = candidate.queuedAt.localeCompare(current.queuedAt);
  if (byQueue !== 0) return byQueue > 0;

  return candidate.updatedAt.localeCompare(current.updatedAt) >= 0;
}

export function buildExportResults(
  snapshots: readonly RenderJobSnapshot[],
  project: ExportProjectContext,
): ExportResult[] {
  const latest = latestPerPreset(snapshots).sort(
    (a, b) =>
      (PRESET_ORDER.get(a.presetId) ?? Number.MAX_SAFE_INTEGER) -
      (PRESET_ORDER.get(b.presetId) ?? Number.MAX_SAFE_INTEGER),
  );

  const presets = latest
    .map((snapshot) => findExportPreset(snapshot.presetId))
    .filter((preset): preset is ExportPreset => preset !== null);

  // In één keer, zodat twee presets nooit dezelfde bestandsnaam krijgen.
  const fileNames = buildExportFileNames(presets, {
    title: project.title,
    reference: project.reference ?? null,
    city: project.city ?? null,
  });

  return latest.map((snapshot) => toResult(snapshot, fileNames, project));
}

function toResult(
  snapshot: RenderJobSnapshot,
  fileNames: Map<ID, string>,
  project: ExportProjectContext,
): ExportResult {
  const preset = findExportPreset(snapshot.presetId);
  const isDone = snapshot.status === "done";

  return {
    jobId: snapshot.jobId,
    presetId: snapshot.presetId,
    label: preset?.label ?? "Onbekend exportformaat",
    platformLabel: preset ? exportPlatformLabel(preset.platform) : "Onbekend platform",
    preset,
    // Zonder preset weten we niet hoe het bestand hoort te heten; de jobid is
    // dan het enige wat het bestand nog uniek maakt.
    fileName: fileNames.get(snapshot.presetId) ?? `render-${snapshot.jobId}.mp4`,
    metadata: preset ? toMetadata(preset) : null,
    status: snapshot.status,
    stage: snapshot.stage,
    progress: clampProgress(snapshot.progress, snapshot.status),
    message: snapshot.message || describeProgress(snapshot.status, snapshot.stage),
    error: snapshot.error,
    sizeInBytes: snapshot.sizeInBytes,
    estimatedSizeInBytes:
      preset && !isDone
        ? estimateFileSizeInBytes(preset, snapshot.durationInSeconds ?? project.durationInSeconds)
        : null,
    durationInSeconds: snapshot.durationInSeconds ?? project.durationInSeconds,
    // Het bestand komt uit de app en niet uit de opslag, dus een outputUrl die
    // de browser niet kan openen (`file://` bij lokaal renderen) is geen
    // bezwaar — hij moet er alleen zijn.
    isDownloadable: isDone && snapshot.outputUrl !== null,
    hasPoster: snapshot.posterUrl !== null,
    queuedAt: snapshot.queuedAt,
    finishedAt: snapshot.finishedAt,
  };
}

function toMetadata(preset: ExportPreset): ExportMetadata {
  return {
    width: preset.width,
    height: preset.height,
    aspectRatio: preset.aspectRatio,
    fps: preset.fps,
    container: preset.container,
    summary: describeFormat(preset),
    videoBitrateKbps: preset.videoBitrateKbps,
  };
}

/**
 * Een afgewerkte render staat op 100, wat de laatste voortgangsmelding ook
 * zei. Een balk die op 98% blijft hangen naast het woord "Klaar" laat de
 * gebruiker zoeken naar de twee procent die er niet zijn.
 */
function clampProgress(progress: number, status: RenderJobStatus): number {
  if (status === "done") return 100;

  return Math.min(Math.max(Math.round(progress), 0), 100);
}

export function summariseExports(results: readonly ExportResult[]): ExportOverview {
  let done = 0;
  let failed = 0;
  let busy = 0;
  let progressTotal = 0;
  let downloadableCount = 0;
  let downloadableSizeInBytes = 0;
  const retryablePresetIds: ID[] = [];

  for (const result of results) {
    progressTotal += result.progress;

    if (result.status === "done") done += 1;
    else if (result.status === "failed") failed += 1;
    else busy += 1;

    if (result.isDownloadable) {
      downloadableCount += 1;
      downloadableSizeInBytes += result.sizeInBytes ?? 0;
    }

    // Een preset die uit de catalogus verdwenen is, valt niet opnieuw te
    // renderen: er is geen formaat meer om naartoe te renderen.
    if (result.status === "failed" && result.preset) retryablePresetIds.push(result.presetId);
  }

  const total = results.length;

  return {
    total,
    done,
    failed,
    busy,
    progress: total > 0 ? Math.round(progressTotal / total) : 0,
    allDone: total > 0 && done === total,
    isSettled: total > 0 && results.every((result) => isTerminalStatus(result.status)),
    downloadableCount,
    downloadableSizeInBytes,
    retryablePresetIds,
  };
}

/** Of er nog iets beweegt; bepaalt of de pagina blijft meekijken. */
export function hasActiveExports(snapshots: readonly RenderJobSnapshot[]): boolean {
  return snapshots.some((snapshot) => !isTerminalStatus(snapshot.status));
}

/** De naam van het zipbestand met alles erin. */
export function archiveFileName(title: string): string {
  return `${slugify(title) || "exports"}-exports.zip`;
}
