import {
  Ban,
  Feather,
  MoveDown,
  MoveLeft,
  MoveRight,
  MoveUp,
  Sparkles,
  Wind,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import type { ID, MotionEasing, MotionKind, Scene, SceneMotion } from "@/types";

/**
 * Beweging over één foto, op één plek.
 *
 * De hele module draait om twee pure functies:
 *
 * - `motionFrames()` zegt **waar** de camera begint en eindigt.
 * - `motionPhase()` zegt **wanneer** ze onderweg is: tempo en versnelling.
 *
 * Alles daarna leest die twee uit. De preview maakt er een CSS-transform van
 * (`motionStyleAt`), de renderpijplijn een FFmpeg-`zoompan` (`toZoompanFilter`).
 * Zo kan er tussen wat de makelaar ziet en wat er gerenderd wordt niets uit
 * elkaar lopen — dat is de reden dat de berekening hier staat en niet in een
 * component.
 *
 * Een kader is opzettelijk hetzelfde begrip als bij `zoompan`: `zoom` is de
 * vergroting van de foto, `anchorX/anchorY` is waar het uitsnedevenster staat
 * (0 = tegen de linker- of bovenrand, 1 = tegen de rechter- of onderrand).
 */

/* -------------------------------------------------------------------------
 * Grenzen
 * ---------------------------------------------------------------------- */

/**
 * Hoeveel de foto maximaal vergroot wordt bij intensiteit 1. Boven ongeveer
 * 40 % wordt een gewone vastgoedfoto zichtbaar zacht, en dat is precies wat een
 * video goedkoop doet ogen.
 */
export const MAX_ZOOM_FRACTION = 0.4;

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 3;

/* -------------------------------------------------------------------------
 * Soorten beweging
 * ---------------------------------------------------------------------- */

export type MotionOption = {
  id: MotionKind;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Of het focuspunt iets doet bij deze beweging. */
  usesFocus: boolean;
};

export const MOTION_OPTIONS: MotionOption[] = [
  {
    id: "geen",
    label: "Stil",
    description: "De foto staat stil. Rustig, en het snelst om te renderen.",
    icon: Ban,
    usesFocus: false,
  },
  {
    id: "inzoomen",
    label: "Inzoomen",
    description: "Naar het focuspunt toe. De veilige keuze voor een gevel.",
    icon: ZoomIn,
    usesFocus: true,
  },
  {
    id: "uitzoomen",
    label: "Uitzoomen",
    description: "Begint dichtbij en toont daarna de hele ruimte.",
    icon: ZoomOut,
    usesFocus: true,
  },
  {
    id: "pan-links",
    label: "Pan naar links",
    description: "Het beeld schuift van rechts naar links; goed voor een brede leefruimte.",
    icon: MoveLeft,
    usesFocus: true,
  },
  {
    id: "pan-rechts",
    label: "Pan naar rechts",
    description: "Van links naar rechts, met dezelfde rust.",
    icon: MoveRight,
    usesFocus: true,
  },
  {
    id: "pan-omhoog",
    label: "Pan omhoog",
    description: "Van de vloer naar het plafond. Werkt bij hoge ruimtes en gevels.",
    icon: MoveUp,
    usesFocus: true,
  },
  {
    id: "pan-omlaag",
    label: "Pan omlaag",
    description: "Van boven naar beneden; sterk als openingsbeeld.",
    icon: MoveDown,
    usesFocus: true,
  },
  {
    id: "ken-burns",
    label: "Ken Burns",
    description: "Inzoomen én schuiven tegelijk. Het meest filmisch, het minst neutraal.",
    icon: Sparkles,
    usesFocus: true,
  },
];

const MOTION_BY_ID = new Map(MOTION_OPTIONS.map((option) => [option.id, option]));

export function getMotionOption(kind: MotionKind): MotionOption {
  return MOTION_BY_ID.get(kind) ?? MOTION_OPTIONS[0]!;
}

export const MOTION_LABELS = Object.fromEntries(
  MOTION_OPTIONS.map((option) => [option.id, option.label]),
) as Record<MotionKind, string>;

export function isMotionKind(value: unknown): value is MotionKind {
  return typeof value === "string" && MOTION_BY_ID.has(value as MotionKind);
}

/* -------------------------------------------------------------------------
 * Versnelling
 * ---------------------------------------------------------------------- */

export type EasingOption = {
  id: MotionEasing;
  label: string;
  description: string;
};

export const EASING_OPTIONS: EasingOption[] = [
  {
    id: "zacht",
    label: "Zacht",
    description: "Komt op gang en bolt uit. De rustigste van de vier.",
  },
  {
    id: "lineair",
    label: "Gelijkmatig",
    description: "Even snel van begin tot eind, zoals een camera op rails.",
  },
  {
    id: "start-traag",
    label: "Traag starten",
    description: "Begint bijna stil en versnelt naar het einde.",
  },
  {
    id: "eind-traag",
    label: "Traag eindigen",
    description: "Vertrekt meteen en komt zacht tot stilstand.",
  },
];

/** De curve als gewone functie; `phase` en de FFmpeg-expressie delen deze vorm. */
function ease(easing: MotionEasing, t: number): number {
  switch (easing) {
    case "lineair":
      return t;
    case "zacht":
      // Smoothstep: de klassieke S-curve, met snelheid nul aan beide kanten.
      return t * t * (3 - 2 * t);
    case "start-traag":
      return t * t;
    case "eind-traag":
      return t * (2 - t);
  }
}

/**
 * Dezelfde curve als FFmpeg-expressie. `phase` is de tekst die de fractie
 * oplevert; ze wordt hier ingevuld, want `zoompan` kent geen eigen variabelen.
 */
function easeExpression(easing: MotionEasing, phase: string): string {
  switch (easing) {
    case "lineair":
      return phase;
    case "zacht":
      return `(${phase})*(${phase})*(3-2*(${phase}))`;
    case "start-traag":
      return `(${phase})*(${phase})`;
    case "eind-traag":
      return `(${phase})*(2-(${phase}))`;
  }
}

/* -------------------------------------------------------------------------
 * De configuratie zelf
 * ---------------------------------------------------------------------- */

export const DEFAULT_MOTION: SceneMotion = {
  kind: "inzoomen",
  intensity: 0.3,
  speed: 1,
  easing: "zacht",
  focusX: 0.5,
  focusY: 0.5,
};

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  return Math.min(Math.max(value, min), max);
}

/**
 * Elke waarde binnen haar grenzen, en alles wat ontbreekt aangevuld.
 *
 * Dit is de enige plek waar een `SceneMotion` ontstaat. Wat er ook binnenkomt —
 * een preset, een schuifregelaar, een rij uit de databank of een oudere opzet
 * waarin de intensiteit nog "subtiel" of "sterk" heette — er komt hier een
 * geldige configuratie uit. De reducer, de serveractie en het inlezen van een
 * project gebruiken allemaal deze functie, zodat een ongeldige beweging nergens
 * kan bestaan, ook niet even.
 */
export function normaliseMotion(input: Partial<SceneMotion> | null | undefined): SceneMotion {
  if (!input) return { ...DEFAULT_MOTION };

  return {
    kind: isMotionKind(input.kind) ? input.kind : DEFAULT_MOTION.kind,
    intensity: legacyIntensity(input.intensity),
    speed: clamp(input.speed as number, MIN_SPEED, MAX_SPEED, DEFAULT_MOTION.speed),
    easing: EASING_OPTIONS.some((option) => option.id === input.easing)
      ? (input.easing as MotionEasing)
      : DEFAULT_MOTION.easing,
    focusX: clamp(input.focusX as number, 0, 1, 0.5),
    focusY: clamp(input.focusY as number, 0, 1, 0.5),
  };
}

/** De drie oude vaste standen, voor projecten die nog van vóór de regelaar zijn. */
const LEGACY_INTENSITY: Record<string, number> = {
  subtiel: 0.15,
  normaal: 0.3,
  sterk: 0.55,
};

function legacyIntensity(value: unknown): number {
  if (typeof value === "string") return LEGACY_INTENSITY[value] ?? DEFAULT_MOTION.intensity;

  return clamp(value as number, 0, 1, DEFAULT_MOTION.intensity);
}

export function createMotion(overrides: Partial<SceneMotion> = {}): SceneMotion {
  return normaliseMotion({ ...DEFAULT_MOTION, ...overrides });
}

/** Hoeveel de foto vergroot wordt bij deze intensiteit: 0.3 -> 12 %. */
export function zoomFraction(intensity: number): number {
  return clamp(intensity, 0, 1, DEFAULT_MOTION.intensity) * MAX_ZOOM_FRACTION;
}

/* -------------------------------------------------------------------------
 * Presets
 * ---------------------------------------------------------------------- */

export type MotionPreset = {
  id: ID;
  label: string;
  description: string;
  icon: LucideIcon;
  motion: SceneMotion;
};

/**
 * De kant-en-klare bewegingen. Een preset is niets meer dan een `SceneMotion`
 * met een naam: kiezen zet alle waarden ineens, en elke waarde blijft daarna
 * los bij te stellen.
 *
 * "Slow zoom" en "Slow pan" zijn daarom geen aparte soorten beweging maar een
 * andere afstelling van in- en uitzoomen: een groot traject op een laag tempo,
 * gelijkmatig, zodat het beeld blijft kruipen zonder ooit aan te komen.
 */
export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "geen",
    label: "Geen",
    description: "Stilstaand beeld.",
    icon: Ban,
    motion: createMotion({ kind: "geen", intensity: 0, speed: 1, easing: "lineair" }),
  },
  {
    id: "zoom-in",
    label: "Zoom in",
    description: "Naar het focuspunt toe, zacht op gang.",
    icon: ZoomIn,
    motion: createMotion({ kind: "inzoomen", intensity: 0.3, speed: 1, easing: "zacht" }),
  },
  {
    id: "zoom-out",
    label: "Zoom uit",
    description: "Van dichtbij naar de hele ruimte.",
    icon: ZoomOut,
    motion: createMotion({ kind: "uitzoomen", intensity: 0.3, speed: 1, easing: "zacht" }),
  },
  {
    id: "pan-left",
    label: "Pan links",
    description: "Schuift van rechts naar links.",
    icon: MoveLeft,
    motion: createMotion({ kind: "pan-links", intensity: 0.3, speed: 1, easing: "zacht" }),
  },
  {
    id: "pan-right",
    label: "Pan rechts",
    description: "Schuift van links naar rechts.",
    icon: MoveRight,
    motion: createMotion({ kind: "pan-rechts", intensity: 0.3, speed: 1, easing: "zacht" }),
  },
  {
    id: "pan-up",
    label: "Pan omhoog",
    description: "Van de vloer naar het plafond.",
    icon: MoveUp,
    motion: createMotion({ kind: "pan-omhoog", intensity: 0.3, speed: 1, easing: "zacht" }),
  },
  {
    id: "pan-down",
    label: "Pan omlaag",
    description: "Van boven naar beneden.",
    icon: MoveDown,
    motion: createMotion({ kind: "pan-omlaag", intensity: 0.3, speed: 1, easing: "zacht" }),
  },
  {
    id: "ken-burns",
    label: "Ken Burns",
    description: "Inzoomen en schuiven tegelijk, van hoek naar focuspunt.",
    icon: Sparkles,
    motion: createMotion({ kind: "ken-burns", intensity: 0.35, speed: 1, easing: "zacht" }),
  },
  {
    id: "slow-zoom",
    label: "Slow zoom",
    description: "Groot traject op laag tempo: het beeld kruipt en komt nooit aan.",
    icon: Feather,
    motion: createMotion({ kind: "inzoomen", intensity: 0.75, speed: 0.45, easing: "lineair" }),
  },
  {
    id: "slow-pan",
    label: "Slow pan",
    description: "Hetzelfde, maar zijwaarts. Rustig genoeg voor een lange scène.",
    icon: Wind,
    motion: createMotion({ kind: "pan-rechts", intensity: 0.8, speed: 0.4, easing: "lineair" }),
  },
];

const PRESETS_BY_ID = new Map(MOTION_PRESETS.map((preset) => [preset.id, preset]));

/**
 * De preset als wijziging, zónder het focuspunt: waar de aandacht in een foto
 * ligt, hoort bij die foto en niet bij de beweging. Een preset kiezen mag dus
 * niet ongemerkt terugzetten waar de gebruiker naartoe wilde zoomen.
 */
/**
 * De beweging van een preset, eventueel met een afwijking erop. Zo hoeven
 * templates geen eigen getallen te verzinnen: ze wijzen een preset aan, en wat
 * ze bewust anders willen zetten ze erbovenop.
 */
export function presetMotion(presetId: ID, overrides: Partial<SceneMotion> = {}): SceneMotion {
  return normaliseMotion({ ...(findMotionPreset(presetId)?.motion ?? DEFAULT_MOTION), ...overrides });
}

export function presetMotionChanges(preset: MotionPreset): Partial<SceneMotion> {
  const { kind, intensity, speed, easing } = preset.motion;

  return { kind, intensity, speed, easing };
}

export function findMotionPreset(presetId: ID): MotionPreset | null {
  return PRESETS_BY_ID.get(presetId) ?? null;
}

/**
 * Welke preset hier onder ligt, of `null` bij een eigen afstelling. Het
 * focuspunt telt niet mee: dat verschilt per foto en zegt niets over de
 * beweging zelf.
 */
export function matchMotionPreset(motion: SceneMotion): MotionPreset | null {
  return (
    MOTION_PRESETS.find(
      (preset) =>
        preset.motion.kind === motion.kind &&
        Math.abs(preset.motion.intensity - motion.intensity) < 0.005 &&
        Math.abs(preset.motion.speed - motion.speed) < 0.005 &&
        preset.motion.easing === motion.easing,
    ) ?? null
  );
}

/** Korte omschrijving voor een lijst: "Zoom in · 12 % · traag". */
export function describeMotion(motion: SceneMotion): string {
  if (motion.kind === "geen") return MOTION_LABELS.geen;

  const preset = matchMotionPreset(motion);
  const label = preset?.label ?? MOTION_LABELS[motion.kind];
  const percentage = Math.round(zoomFraction(motion.intensity) * 100);
  const tempo = motion.speed < 0.85 ? " · traag" : motion.speed > 1.3 ? " · snel" : "";

  return `${label} · ${percentage} %${tempo}`;
}

/* -------------------------------------------------------------------------
 * Rekenwerk
 * ---------------------------------------------------------------------- */

export type MotionFrame = {
  /** 1 = de hele foto in beeld. */
  zoom: number;
  anchorX: number;
  anchorY: number;
};

export type MotionFrames = {
  from: MotionFrame;
  to: MotionFrame;
};

/**
 * Het begin- en eindkader van de beweging: het volledige traject, los van het
 * tempo.
 *
 * Panbewegingen zoomen altijd een beetje in: zonder overschot is er niets om
 * doorheen te schuiven. Dat overschot ís meteen de afstand die het beeld
 * aflegt, dus een grotere intensiteit geeft zowel meer marge als meer beweging.
 */
export function motionFrames(motion: SceneMotion): MotionFrames {
  const amount = zoomFraction(motion.intensity);
  const zoomed = 1 + amount;
  const { focusX, focusY } = motion;

  switch (motion.kind) {
    case "geen":
      return {
        from: { zoom: 1, anchorX: 0.5, anchorY: 0.5 },
        to: { zoom: 1, anchorX: 0.5, anchorY: 0.5 },
      };

    case "inzoomen":
      return {
        from: { zoom: 1, anchorX: focusX, anchorY: focusY },
        to: { zoom: zoomed, anchorX: focusX, anchorY: focusY },
      };

    case "uitzoomen":
      return {
        from: { zoom: zoomed, anchorX: focusX, anchorY: focusY },
        to: { zoom: 1, anchorX: focusX, anchorY: focusY },
      };

    case "pan-links":
      return {
        from: { zoom: zoomed, anchorX: 1, anchorY: focusY },
        to: { zoom: zoomed, anchorX: 0, anchorY: focusY },
      };

    case "pan-rechts":
      return {
        from: { zoom: zoomed, anchorX: 0, anchorY: focusY },
        to: { zoom: zoomed, anchorX: 1, anchorY: focusY },
      };

    case "pan-omhoog":
      return {
        from: { zoom: zoomed, anchorX: focusX, anchorY: 1 },
        to: { zoom: zoomed, anchorX: focusX, anchorY: 0 },
      };

    case "pan-omlaag":
      return {
        from: { zoom: zoomed, anchorX: focusX, anchorY: 0 },
        to: { zoom: zoomed, anchorX: focusX, anchorY: 1 },
      };

    case "ken-burns":
      return {
        from: { zoom: 1, anchorX: 1 - focusX, anchorY: 1 - focusY },
        to: { zoom: zoomed + amount / 2, anchorX: focusX, anchorY: focusY },
      };
  }
}

/**
 * Hoever de camera op dit moment op haar traject staat, van 0 tot 1.
 *
 * `progress` is de plaats in de scène (0 = eerste beeld, 1 = laatste). Het
 * tempo rekt of krimpt dat: bij tempo 2 is de beweging al klaar op de helft en
 * staat het beeld daarna stil, bij tempo 0,5 raakt ze niet verder dan de helft
 * van haar traject. Daarna legt de versnellingscurve nog vast hoe die fractie
 * over de tijd verdeeld is.
 */
export function motionPhase(motion: SceneMotion, progress: number): number {
  const linear = Math.min(Math.max(progress, 0), 1) * motion.speed;

  return ease(motion.easing, Math.min(linear, 1));
}

/** Het kader op dit punt in de scène. */
export function motionFrameAt(motion: SceneMotion, progress: number): MotionFrame {
  const { from, to } = motionFrames(motion);
  const phase = motionPhase(motion, progress);

  return {
    zoom: from.zoom + (to.zoom - from.zoom) * phase,
    anchorX: from.anchorX + (to.anchorX - from.anchorX) * phase,
    anchorY: from.anchorY + (to.anchorY - from.anchorY) * phase,
  };
}

export type MotionStyle = {
  transform: string;
  transformOrigin: string;
};

/**
 * Hetzelfde kader als CSS. `transform-origin` in procenten schaalt rond precies
 * het punt waar `zoompan` zijn uitsnede legt, dus de preview toont dezelfde
 * beeldvulling als de render — geen tweede benadering ernaast.
 */
export function motionStyleAt(motion: SceneMotion, progress: number): MotionStyle {
  const frame = motionFrameAt(motion, progress);

  return {
    transform: `scale(${frame.zoom.toFixed(4)})`,
    transformOrigin: `${(frame.anchorX * 100).toFixed(2)}% ${(frame.anchorY * 100).toFixed(2)}%`,
  };
}

/**
 * Het uitsnedevenster als rechthoek in de foto, met zijden van 0 tot 1.
 * Hiermee tekent de mini-preview wat de camera ziet; het is dezelfde uitsnede
 * die `zoompan` maakt.
 */
export type MotionRect = { x: number; y: number; width: number; height: number };

export function motionRectAt(motion: SceneMotion, progress: number): MotionRect {
  const { zoom, anchorX, anchorY } = motionFrameAt(motion, progress);
  const size = 1 / zoom;

  return {
    x: (1 - size) * anchorX,
    y: (1 - size) * anchorY,
    width: size,
    height: size,
  };
}

/* -------------------------------------------------------------------------
 * FFmpeg
 * ---------------------------------------------------------------------- */

export type ZoompanOptions = {
  durationInSeconds: number;
  fps: number;
  /** Uitvoerformaat, bijvoorbeeld `1920x1080`. */
  size: string;
};

export type ZoompanFilter = {
  /** De volledige filterstring, klaar om achter `-vf` te hangen. */
  filter: string;
  /** De losse expressies, handig om te loggen of te testen. */
  z: string;
  x: string;
  y: string;
  frames: number;
};

/**
 * Dezelfde beweging als FFmpeg-`zoompan`.
 *
 * Deze functie draait nog nergens in de app: de renderworker bestaat nog niet
 * (zie `src/workers/render-worker.ts`). Ze staat hier omdat de motioninstelling
 * anders een vorm zonder betekenis is — dit is wat de instelling straks
 * letterlijk wordt, en meteen de reden dat de preview klopt.
 *
 * De opbouw volgt exact `motionPhase()`: eerst de fractie met het tempo erin en
 * afgekapt op 1, dan de versnellingscurve eromheen, dan pas de interpolatie.
 */
export function toZoompanFilter(motion: SceneMotion, options: ZoompanOptions): ZoompanFilter {
  const { from, to } = motionFrames(motion);
  const frames = Math.max(Math.round(options.durationInSeconds * options.fps), 1);
  // `on` is het huidige frame; over `frames - 1` stappen gaan we van begin naar
  // eind. Bij één frame zou dat een deling door nul zijn.
  const span = Math.max(frames - 1, 1);

  // min(...,1) is het "klaar en dan stilstaan" van een tempo boven 1.
  const linear =
    motion.speed === 1 ? `on/${span}` : `min(on/${span}*${motion.speed.toFixed(3)},1)`;
  const phase = easeExpression(motion.easing, linear);

  const lerp = (start: number, end: number) =>
    Math.abs(end - start) < 1e-6
      ? start.toFixed(4)
      : `${start.toFixed(4)}+(${(end - start).toFixed(4)})*(${phase})`;

  const z = lerp(from.zoom, to.zoom);
  // Het venster is `iw/zoom` breed; de ankerwaarde verdeelt wat overblijft.
  const x = `(iw-iw/zoom)*(${lerp(from.anchorX, to.anchorX)})`;
  const y = `(ih-ih/zoom)*(${lerp(from.anchorY, to.anchorY)})`;

  return {
    filter: `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${options.size}:fps=${options.fps}`,
    z,
    x,
    y,
    frames,
  };
}

/* -------------------------------------------------------------------------
 * Per foto bewaard
 * ---------------------------------------------------------------------- */

/**
 * De beweging van elke foto, op asset-id.
 *
 * In de editor hangt een beweging aan een scène, maar een scène ís één foto —
 * en de renderpijplijn werkt met assets, niet met scènes. Deze functie is de
 * brug: scènes waarvan de upload nog loopt hebben nog geen asset en vallen weg.
 */
export function motionByAssetId(scenes: Scene[]): Record<ID, SceneMotion> {
  const byAsset: Record<ID, SceneMotion> = {};

  for (const scene of scenes) {
    if (!scene.assetId) continue;

    byAsset[scene.assetId] = normaliseMotion(scene.motion);
  }

  return byAsset;
}
