import { findExportPreset } from "@/lib/editor/export-presets";
import type { RenderPlan } from "@/lib/editor/render-plan";
import { renderFpsOverride, renderResolutionVariant } from "@/workers/config";
import type { ExportPlatform, ExportPreset, ID } from "@/types";

/**
 * De vertaling van een exportpreset naar FFmpeg-instellingen.
 *
 * `ExportPreset` beschrijft wat de gebruiker kiest: waar de video heen gaat,
 * hoe groot en hoe zwaar. Hier staat wat dat voor de encoder betekent. Die
 * twee bewust uit elkaar houden heeft één praktische reden: een platform dat
 * morgen andere eisen stelt — LinkedIn dat geen high profile meer slikt,
 * WhatsApp dat op oude toestellen moet blijven spelen — verandert dan één
 * regel in `PLATFORM_ENCODING` en niets in de editor.
 *
 * Alles hier is een pure afbeelding van waarden op waarden. Er wordt niets
 * uitgevoerd en niets gemeten; dat is wat een render bij gelijke invoer
 * voorspelbaar houdt.
 */

/* -------------------------------------------------------------------------
 * Waar de video naartoe gerenderd wordt
 * ---------------------------------------------------------------------- */

/**
 * Het doelformaat van één render. Komt normaal rechtstreeks uit de preset,
 * maar staat er los van zodat dezelfde tijdlijn ook in een andere resolutie of
 * framerate weggeschreven kan worden (`scaleTarget`, `withFps`).
 */
export type RenderTarget = {
  presetId: ID;
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  container: string;
  /** `1920x1080`: het formaat zoals `zoompan`, `color` en `scale` het willen. */
  size: string;
};

/** H.264 wil even afmetingen; een oneven breedte geeft een encoder die weigert. */
export function makeEven(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function toTarget(input: Omit<RenderTarget, "size">): RenderTarget {
  const width = makeEven(input.width);
  const height = makeEven(input.height);

  return { ...input, width, height, size: `${width}x${height}` };
}

export function targetForPreset(preset: ExportPreset): RenderTarget {
  return toTarget({
    presetId: preset.id,
    width: preset.width,
    height: preset.height,
    fps: preset.fps,
    videoBitrateKbps: preset.videoBitrateKbps,
    audioBitrateKbps: preset.audioBitrateKbps,
    container: preset.container,
  });
}

/**
 * Hetzelfde, maar uit het plan. De worker heeft de preset niet in handen: het
 * plan is de opdracht, en die is al vastgelegd toen de job in de wachtrij ging.
 */
export function targetForPlan(plan: RenderPlan): RenderTarget {
  return toTarget({
    presetId: plan.presetId,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    videoBitrateKbps: plan.videoBitrateKbps,
    audioBitrateKbps: plan.audioBitrateKbps,
    container: plan.container,
  });
}

/**
 * De resoluties waarin dezelfde video weggeschreven kan worden.
 *
 * De korte zijde is de maat, niet de breedte: een staande 1080x1920 en een
 * liggende 1920x1080 zijn allebei "1080p", en zo werkt dit voor elke
 * beeldverhouding. De bitrate schaalt mee met het aantal pixels en niet met de
 * hoogte — half zo hoog is een kwart zoveel beeld.
 */
export type ResolutionVariant = {
  id: ID;
  label: string;
  /** Korte zijde in pixels; `null` = laat de preset zoals ze is. */
  shortEdge: number | null;
};

export const RESOLUTION_VARIANTS: ResolutionVariant[] = [
  { id: "preset", label: "Zoals de preset", shortEdge: null },
  { id: "1080p", label: "1080p", shortEdge: 1080 },
  { id: "720p", label: "720p", shortEdge: 720 },
  { id: "480p", label: "480p", shortEdge: 480 },
];

export function findResolutionVariant(variantId: ID): ResolutionVariant | null {
  return RESOLUTION_VARIANTS.find((variant) => variant.id === variantId) ?? null;
}

/**
 * Hetzelfde doel op een andere resolutie. De verhouding blijft, de bitrate
 * schaalt met het pixelaantal — zo blijft de beeldkwaliteit vergelijkbaar in
 * plaats van dat een kleine video onnodig zwaar wordt.
 */
export function scaleTarget(target: RenderTarget, variantId: ID): RenderTarget {
  const variant = findResolutionVariant(variantId);

  if (!variant?.shortEdge) return target;

  const shortEdge = Math.min(target.width, target.height);
  if (shortEdge <= variant.shortEdge) return target;

  const factor = variant.shortEdge / shortEdge;

  return toTarget({
    ...target,
    width: target.width * factor,
    height: target.height * factor,
    // Pixels schalen met het kwadraat van de factor; de bitrate volgt.
    videoBitrateKbps: Math.round(target.videoBitrateKbps * factor * factor),
  });
}

/** Dezelfde video op een andere framerate; alles wat frames telt volgt hieruit. */
export function withFps(target: RenderTarget, fps: number): RenderTarget {
  return { ...target, fps: Math.max(Math.round(fps), 1) };
}

/**
 * Het doel waarop deze worker echt rendert.
 *
 * Normaal is dat precies wat de preset zegt. `RENDER_RESOLUTION` en
 * `RENDER_FPS` kunnen er een kleiner of trager formaat van maken — bruikbaar op
 * een testomgeving of een machine zonder kracht, en de enige plek waar het
 * gebeurt, zodat scènes en samenvoegen nooit op verschillende formaten kunnen
 * uitkomen.
 */
export function resolveTarget(plan: RenderPlan): RenderTarget {
  const scaled = scaleTarget(targetForPlan(plan), renderResolutionVariant());
  const fps = renderFpsOverride();

  return fps ? withFps(scaled, fps) : scaled;
}

/* -------------------------------------------------------------------------
 * Encoderinstellingen
 * ---------------------------------------------------------------------- */

export type EncodingProfile = {
  videoCodec: string;
  /** Snelheid tegenover compressie: `veryfast` ... `veryslow`. */
  x264Preset: string;
  /**
   * Kwaliteit als CRF, met de bitrate van de preset als plafond. Een
   * fotoslideshow is grotendeels stilstaand beeld; op een vaste bitrate gaat
   * daar bandbreedte in zitten die niets toevoegt, en zit er tijdens de enige
   * beweging die er is net te weinig in.
   */
  crf: number;
  profile: string;
  level: string;
  pixelFormat: string;
  /** Afstand tussen keyframes in seconden. Platformen die hersnijden willen er genoeg. */
  keyframeSeconds: number;
  audioCodec: string;
  audioSampleRate: number;
  audioChannels: number;
  /** Extra uitvoerargumenten; `+faststart` zet de index vooraan zodat een video meteen speelt. */
  extraArgs: string[];
};

export const BASE_ENCODING: EncodingProfile = {
  videoCodec: "libx264",
  x264Preset: "medium",
  crf: 20,
  profile: "high",
  level: "4.1",
  pixelFormat: "yuv420p",
  keyframeSeconds: 2,
  audioCodec: "aac",
  audioSampleRate: 48000,
  audioChannels: 2,
  extraArgs: ["-movflags", "+faststart"],
};

/**
 * Wat er per platform anders moet. Alleen de afwijkingen staan hier — wat
 * ontbreekt komt uit `BASE_ENCODING`, zodat in één oogopslag te zien is wat een
 * platform bijzonder maakt.
 *
 * De sleutels zijn platformen en geen presets: LinkedIn stelt dezelfde eisen
 * aan een vierkante als aan een liggende video, en die regel twee keer zetten
 * is twee keer iets om te vergeten. Een nieuw platform toevoegen is dus een
 * regel in de catalogus plus, als het eigen eisen heeft, een regel hier.
 */
export const PLATFORM_ENCODING: Partial<Record<ExportPlatform, Partial<EncodingProfile>>> = {
  // Speelt in een browser en op een tv; daar mag de kwaliteit het hoogst zijn.
  website: { crf: 19, level: "4.2", x264Preset: "slow" },
  // Instagram hercomprimeert sowieso. Netjes aanleveren betekent hier vooral
  // een korte keyframe-afstand, zodat hun encoder niet hoeft te zoeken.
  "instagram-feed": { crf: 20 },
  "instagram-reels": { crf: 20, keyframeSeconds: 1 },
  tiktok: { crf: 19, keyframeSeconds: 1 },
  linkedin: { crf: 21 },
  facebook: { crf: 21 },
  // Moet ook op een oud toestel spelen en klein genoeg blijven om te versturen:
  // baseline profile en een lagere kwaliteit.
  whatsapp: {
    crf: 23,
    profile: "baseline",
    level: "3.1",
    x264Preset: "faster",
    keyframeSeconds: 3,
  },
};

/**
 * De worker heeft alleen de preset-id uit het plan; het platform erachter komt
 * uit de catalogus. Bestaat die preset niet meer, dan blijft het bij de
 * basisinstellingen — het renderen zelf hangt er niet van af.
 */
export function encodingFor(presetId: ID): EncodingProfile {
  const platform = findExportPreset(presetId)?.platform;

  return { ...BASE_ENCODING, ...(platform ? PLATFORM_ENCODING[platform] : null) };
}

/**
 * Tussenbestand of eindbestand.
 *
 * Elke scène wordt eerst apart gerenderd. Gaat er daarna nog een keten van
 * overgangen overheen, dan wordt dat tussenbestand toch opnieuw gecodeerd en
 * mag het snel en ruim zijn. Zijn alle overgangen harde cuts, dan worden de
 * clips zonder hercodering aan elkaar geplakt en ís het tussenbestand het
 * eindbestand — dan moet het meteen op de instellingen van het platform staan.
 */
export type EncodingMode = "tussen" | "eind";

/**
 * De videoargumenten voor FFmpeg, in de volgorde waarin ze op de opdrachtregel
 * horen te staan.
 */
export function videoEncodingArgs(
  profile: EncodingProfile,
  target: RenderTarget,
  mode: EncodingMode,
): string[] {
  // `-g` telt in frames, niet in seconden. Omrekenen met de framerate zet bij
  // elke framerate een keyframe op dezelfde seconde.
  const gop = Math.max(Math.round(profile.keyframeSeconds * target.fps), 1);

  const args = [
    "-c:v",
    profile.videoCodec,
    "-preset",
    mode === "tussen" ? "veryfast" : profile.x264Preset,
    // Een tussenbestand mag ruimer: wat hier weggegooid wordt, komt in de
    // hercodering niet meer terug.
    "-crf",
    String(mode === "tussen" ? Math.max(profile.crf - 3, 12) : profile.crf),
    "-profile:v",
    profile.profile,
    "-level:v",
    profile.level,
    "-pix_fmt",
    profile.pixelFormat,
    "-g",
    String(gop),
    "-keyint_min",
    String(gop),
    // Geen extra keyframe bij een scènewissel: ze staan al op vaste afstand, en
    // een keyframe per foto maakt het bestand alleen groter.
    "-sc_threshold",
    "0",
    "-r",
    String(target.fps),
  ];

  if (mode === "eind") {
    // CRF met een plafond: de kwaliteit stuurt, de preset begrenst. De buffer
    // is twee seconden bitrate — genoeg voor elke speler.
    args.push(
      "-maxrate",
      `${target.videoBitrateKbps}k`,
      "-bufsize",
      `${target.videoBitrateKbps * 2}k`,
      ...profile.extraArgs,
    );
  }

  return args;
}

/** De audioargumenten. Alleen zinvol als er ook echt een spoor is. */
export function audioEncodingArgs(profile: EncodingProfile, target: RenderTarget): string[] {
  return [
    "-c:a",
    profile.audioCodec,
    "-b:a",
    `${target.audioBitrateKbps}k`,
    "-ar",
    String(profile.audioSampleRate),
    "-ac",
    String(profile.audioChannels),
  ];
}
