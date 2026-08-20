import { toZoompanFilter } from "@/lib/editor/motion";
import type { ScenePlan } from "@/lib/editor/render-plan";
import type { TransitionId } from "@/lib/editor/templates";
import type { LogoPlacement, MotionKind, SceneMotion } from "@/types";
import type { RenderTarget } from "@/workers/render/ffmpeg/config";
import { makeEven } from "@/workers/render/ffmpeg/config";

/**
 * De filtergrafen: hier wordt een instelling uit de editor letterlijk een
 * stukje FFmpeg-tekst.
 *
 * Er staat bewust geen enkele beslissing in dit bestand over *wat* er beweegt.
 * Waar de camera begint en eindigt, hoe snel ze gaat en hoe ze versnelt, staat
 * in `src/lib/editor/motion.ts` — dezelfde module waar de preview mee tekent.
 * Wat hier gebeurt is het omhulsel eromheen: de foto op formaat brengen, de
 * `zoompan` erop zetten, de clips aan elkaar praten. Zo kan de render niet
 * anders uitkomen dan de preview: er is maar één plek waar de beweging bestaat.
 */

export type AspectFit = "cover" | "contain";

/* -------------------------------------------------------------------------
 * Van foto naar beeldkader
 * ---------------------------------------------------------------------- */

export type FitOptions = {
  width: number;
  height: number;
  fit: AspectFit;
  /** Vulkleur bij `contain`. */
  padColor: string;
};

/**
 * De foto op precies dit formaat brengen.
 *
 * `cover` schaalt tot het kader vol is en snijdt de rest weg — dat is wat de
 * editor toont en wat een makelaar verwacht: een staande export van een
 * liggende foto is bijgesneden, niet met balken. `contain` legt de hele foto op
 * een vlak, voor wie liever niets kwijtspeelt.
 *
 * `force_original_aspect_ratio` doet het rekenwerk in FFmpeg zelf, zodat we de
 * afmetingen van de bronfoto niet hoeven te kennen: geen ffprobe per foto, en
 * geen kans dat onze berekening en die van de encoder uit elkaar lopen.
 */
export function fitFilters({ width, height, fit, padColor }: FitOptions): string[] {
  if (fit === "contain") {
    return [
      `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${padColor}`,
    ];
  }

  return [
    // `increase` schaalt tot beide zijden minstens het kader vullen; `crop`
    // haalt er zonder offset (dus gecentreerd) het kader uit.
    `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${width}:${height}`,
  ];
}

/* -------------------------------------------------------------------------
 * Beweging
 * ---------------------------------------------------------------------- */

/**
 * Wat elke bewegingssoort met de camera doet, in gewone woorden.
 *
 * Dit is documentatie én logregel, geen tweede implementatie: de getallen
 * komen uit `motionFrames()`. Wie zich afvraagt waarom een pan naar links
 * begint met een ingezoomd beeld, leest het hier en vindt het daar terug.
 */
export const ZOOMPAN_MAPPING: Record<MotionKind, string> = {
  geen: "geen zoompan; de foto wordt één keer geschaald en blijft staan",
  inzoomen: "z loopt van 1 naar 1+f, x/y blijven op het focuspunt",
  uitzoomen: "z loopt van 1+f naar 1, x/y blijven op het focuspunt",
  "pan-links": "z vast op 1+f, x loopt van de rechter- naar de linkerrand",
  "pan-rechts": "z vast op 1+f, x loopt van de linker- naar de rechterrand",
  "pan-omhoog": "z vast op 1+f, y loopt van de onder- naar de bovenrand",
  "pan-omlaag": "z vast op 1+f, y loopt van de boven- naar de onderrand",
  "ken-burns": "z loopt van 1 naar 1+1,5f terwijl x/y van de tegenhoek naar het focuspunt schuiven",
};

/** Korte samenvatting van één beweging, voor in de logs van een render. */
export function describeSceneMotion(motion: SceneMotion): string {
  return `${motion.kind}: ${ZOOMPAN_MAPPING[motion.kind]} (f=${motion.intensity.toFixed(2)}, tempo ${motion.speed.toFixed(2)}, ${motion.easing})`;
}

export type SceneFilterOptions = {
  target: RenderTarget;
  fit: AspectFit;
  padColor: string;
  /**
   * Hoeveel groter de foto in `zoompan` gaat dan het uitvoerformaat. Zie
   * `zoompanSupersample()` in `src/workers/config.ts` voor waarom dat nodig is.
   */
  supersample: number;
  logo?: LogoOverlay | null;
};

export type SceneFilters = {
  /** De onderdelen van de keten, in volgorde. */
  filters: string[];
  /** De keten zoals FFmpeg ze achter `-vf` wil. */
  chain: string;
  /** Aantal frames dat deze scène oplevert. */
  frames: number;
};

/**
 * De volledige videoketen van één foto.
 *
 * De volgorde is niet vrij:
 *
 * 1. **Schalen en bijsnijden** naar het kader, maal de supersamplefactor. Dat
 *    grotere kader is alleen invoer voor de volgende stap.
 * 2. **`zoompan`** knipt daar per frame een venster uit en zet dat op
 *    uitvoerformaat (`s=`). De expressies komen uit de motionmodule.
 * 3. **Logo** erover, als de huisstijl er een vraagt.
 * 4. **`format` en `setsar`** als laatste: alle clips moeten dezelfde
 *    pixelvorm en pixelverhouding hebben, anders weigert `xfade` ze later aan
 *    elkaar te plakken.
 */
export function buildSceneFilters(scene: ScenePlan, options: SceneFilterOptions): SceneFilters {
  const { target, supersample } = options;
  const still = scene.motion.kind === "geen";

  // Een stilstaande foto heeft geen supersampling nodig: er verschuift niets,
  // dus er kan ook niets trillen. Dat scheelt vier keer zoveel pixels per frame.
  const factor = still ? 1 : supersample;

  const filters = fitFilters({
    width: makeEven(target.width * factor),
    height: makeEven(target.height * factor),
    fit: options.fit,
    padColor: options.padColor,
  });

  // Het plan draagt al een `zoompan` mee, maar die is gebouwd op het formaat
  // van de preset. Hier wordt ze opnieuw gemaakt op het formaat dat we echt
  // renderen, zodat een export in een andere resolutie dezelfde beweging houdt.
  const zoompan = toZoompanFilter(scene.motion, {
    durationInSeconds: scene.durationInSeconds,
    fps: target.fps,
    size: target.size,
  });

  if (still) {
    // Zonder `zoompan` bepaalt de invoer de framerate; `fps` maakt het aantal
    // frames onafhankelijk van hoe de foto binnenkomt.
    filters.push(`fps=${target.fps}`);
  } else {
    filters.push(zoompan.filter);
  }

  if (options.logo) filters.push(...logoFilters(options.logo, target));

  filters.push("format=yuv420p", "setsar=1");

  return { filters, chain: filters.join(","), frames: zoompan.frames };
}

/* -------------------------------------------------------------------------
 * Overgangen
 * ---------------------------------------------------------------------- */

/**
 * De overgangen van de editor als `xfade`-transities.
 *
 * `hard` heeft er geen: een harde cut is geen overgang maar het ontbreken
 * ervan. Zijn álle overgangen hard, dan hoeft er niets hergecodeerd te worden
 * (zie `stitch.ts`); zit er één zachte tussen, dan worden de harde cuts binnen
 * die keten een `concat` en de zachte een `xfade`.
 */
export const XFADE_BY_TRANSITION: Record<TransitionId, string | null> = {
  hard: null,
  crossfade: "fade",
  "dip-to-black": "fadeblack",
  schuif: "slideleft",
};

export type ClipTiming = {
  durationInSeconds: number;
  transition: TransitionId;
  /** Overlap met de vorige clip; 0 bij de eerste. */
  transitionInSeconds: number;
};

export type JoinGraph = {
  /** De losse stappen; samen met `;` de videokant van `-filter_complex`. */
  steps: string[];
  /** Label van de uitgang, bijvoorbeeld `j4`. */
  label: string;
  durationInSeconds: number;
};

/**
 * De keten die alle clips aan elkaar zet.
 *
 * Twee soorten verbindingen, en het verschil is geen detail:
 *
 * - **`xfade`** voor een zachte overgang. Die werkt met een absolute `offset`:
 *   het moment in de *lopende* keten waarop de overgang begint, dus de
 *   opgetelde duur tot hier min de overlap. Elke overgang maakt de video
 *   korter, en precies zoveel korter als de tijdlijn in de editor liet zien.
 * - **`concat`** voor een harde cut. Niet een `xfade` van één frame: die
 *   duurt korter dan een frame duurt, en dan gooit FFmpeg de rest van de
 *   tweede clip weg. Een video van negen seconden met zevenenzeventig frames
 *   erin is het gevolg.
 *
 * Elke invoer krijgt eerst `settb=AVTB` en een nulpunt voor zijn tijdstempels,
 * en elke verbinding zet de tijdbasis daarna weer terug. `concat` levert een
 * andere tijdbasis op dan een ruwe invoer, en `xfade` weigert twee invoeren die
 * niet op dezelfde basis lopen.
 */
export function buildJoinGraph(clips: ClipTiming[], fps: number): JoinGraph {
  const first = clips[0];

  if (!first) return { steps: [], label: "0:v", durationInSeconds: 0 };

  const frame = 1 / fps;
  // Onder twee frames is een overgang geen overgang meer, en FFmpeg rekent er
  // ook niet meer betrouwbaar mee.
  const minimum = frame * 2;

  const steps = clips.map(
    (_, index) => `[${index}:v]settb=AVTB,setpts=PTS-STARTPTS[n${index}]`,
  );

  let label = "n0";
  let total = first.durationInSeconds;

  for (const [index, clip] of clips.entries()) {
    if (index === 0) continue;

    const transition = XFADE_BY_TRANSITION[clip.transition];
    // Een overgang kan nooit langer duren dan de kortste van de twee clips die
    // ze verbindt; anders begint ze vóór de vorige clip bestaat.
    const room = Math.min(total, clip.durationInSeconds) - frame;
    const overlap =
      transition && clip.transitionInSeconds > 0 && room >= minimum
        ? Math.max(Math.min(clip.transitionInSeconds, room), minimum)
        : 0;

    const next = `j${index}`;

    steps.push(
      overlap > 0
        ? `[${label}][n${index}]xfade=transition=${transition}:duration=${overlap.toFixed(3)}:offset=${Math.max(total - overlap, 0).toFixed(3)},settb=AVTB[${next}]`
        : `[${label}][n${index}]concat=n=2:v=1:a=0,settb=AVTB[${next}]`,
    );

    label = next;
    total = total + clip.durationInSeconds - overlap;
  }

  return { steps, label, durationInSeconds: Math.round(total * 1000) / 1000 };
}

/* -------------------------------------------------------------------------
 * Tekst en logo
 * ---------------------------------------------------------------------- */

export type LogoOverlay = {
  /** De initialen uit de brand kit; een echt logobestand is er nog niet. */
  initials: string;
  placement: LogoPlacement;
  color: string;
  /** Pad naar het lettertype; zonder dat tekent `drawtext` niets. */
  fontPath: string;
};

/** Waar het logo staat, als `drawtext`-coördinaten. `tw`/`th` zijn de tekstmaten. */
const LOGO_POSITION: Record<LogoPlacement, { x: string; y: string } | null> = {
  geen: null,
  linksboven: { x: "w*0.04", y: "h*0.04" },
  rechtsboven: { x: "w-tw-w*0.04", y: "h*0.04" },
  linksonder: { x: "w*0.04", y: "h-th-h*0.04" },
  rechtsonder: { x: "w-tw-w*0.04", y: "h-th-h*0.04" },
};

export function logoFilters(logo: LogoOverlay, target: RenderTarget): string[] {
  const position = LOGO_POSITION[logo.placement];

  if (!position) return [];

  // De initialen komen uit een vaste lijst, maar ze gaan rechtstreeks in een
  // filterstring; alles wat geen letter of cijfer is gaat eruit voor het geval
  // een brand kit later door de gebruiker zelf ingevuld wordt.
  const text = logo.initials.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 6);

  if (!text) return [];

  return [
    [
      "drawtext",
      `=fontfile=${escapeFilterPath(logo.fontPath)}`,
      `:text=${text}`,
      `:fontcolor=${logo.color}`,
      `:fontsize=${Math.round(target.height * 0.045)}`,
      `:x=${position.x}`,
      `:y=${position.y}`,
      // Een lichte schaduw houdt het leesbaar op een lichte gevel én op een
      // donkere living, zonder een blok achter de tekst te zetten.
      ":shadowcolor=black@0.45:shadowx=2:shadowy=2",
      ":expansion=none",
    ].join(""),
  ];
}

export type TextCard = {
  /** Bestand met de tekst; zie `escapeFilterPath` voor waarom het een bestand is. */
  textFilePath: string;
  fontPath: string;
  color: string;
  /** Teksthoogte in pixels; zie `cardFontSize()`. */
  fontSize: number;
  /** Verticale positie van het midden van de tekst, als fractie. */
  centerY: number;
};

/**
 * Tekst midden op een kaart.
 *
 * De tekst gaat via `textfile=` en niet inline. Een naam als "Van 't Hof" of
 * een adres met een dubbele punt zou een filterstring anders stukmaken, en
 * ontsnappingsregels van drie lagen diep (shell, filtergraaf, optie) zijn geen
 * plek waar je op zoek wil naar een bug in een render van tien minuten.
 */
export function textCardFilters(card: TextCard): string[] {
  return [
    [
      "drawtext",
      `=fontfile=${escapeFilterPath(card.fontPath)}`,
      `:textfile=${escapeFilterPath(card.textFilePath)}`,
      `:fontcolor=${card.color}`,
      `:fontsize=${card.fontSize}`,
      // `tw`/`th` zijn de maten van het hele tekstblok, dus meerdere regels
      // blijven als geheel gecentreerd staan.
      ":x=(w-tw)/2",
      `:y=(h*${card.centerY.toFixed(3)})-(th/2)`,
      `:line_spacing=${Math.round(card.fontSize * 0.35)}`,
      ":expansion=none",
    ].join(""),
  ];
}

/* -------------------------------------------------------------------------
 * Ontsnappen
 * ---------------------------------------------------------------------- */

/**
 * Een pad zoals een filteroptie het wil: `'C\:/Windows/Fonts/arial.ttf'`.
 *
 * Dat ziet er dubbelop uit en dat is het ook, want er wordt twee keer gelezen.
 * Eerst splitst FFmpeg de filtergraaf (op `,` en `;`, met aandacht voor
 * apostrofs), daarna splitst elke filter zijn eigen opties (op `:`). Alleen
 * ontsnappen werkt niet: de eerste ronde eet de backslash op en de tweede ziet
 * een kale dubbele punt. Alleen quoten werkt evenmin: de eerste ronde haalt de
 * apostrofs weg. Samen wel — de apostrofs beschermen de backslash tot aan de
 * tweede ronde, die er de dubbele punt van maakt.
 *
 * Backslashes worden schuine strepen; FFmpeg neemt op Windows ook `C:/...`.
 */
export function escapeFilterPath(path: string): string {
  const escaped = path
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    // Een apostrof in het pad sluit de quote, wordt los ontsnapt en opent hem
    // weer — dezelfde truc als in een shell.
    .replace(/'/g, "'\\''");

  return `'${escaped}'`;
}

/**
 * Eén regel voor de concat-demuxer. Die leest zelf een bestand in, dus hier
 * gelden de regels van dat formaat: het pad tussen apostrofs, en een apostrof
 * in het pad afgesloten en opnieuw geopend.
 */
export function concatListEntry(path: string): string {
  return `file '${path.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
}
