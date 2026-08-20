import { contactLines } from "@/lib/brand/kit";
import type { RenderPlan } from "@/lib/editor/render-plan";
import type { EncodingMode, EncodingProfile, RenderTarget } from "@/workers/render/ffmpeg/config";
import { videoEncodingArgs } from "@/workers/render/ffmpeg/config";
import { textCardFilters } from "@/workers/render/ffmpeg/filters";

/**
 * De intro- en contactkaart.
 *
 * Het renderplan rekent ze al mee in de duur (`introSeconds`, `outroSeconds`),
 * dus ze overslaan zou een video opleveren die korter is dan wat de editor
 * toonde. Ze zijn bewust het eenvoudigste wat werkt: een vlak in de kleur van
 * de huisstijl met tekst erop. Geen bewegende titels, geen gegenereerd beeld —
 * wat erin staat, heeft de gebruiker zelf ingevuld.
 *
 * Zonder lettertype (`RENDER_FONT_PATH`) blijft het vlak leeg in plaats van dat
 * de render stukloopt op een `drawtext` die niets kan tekenen.
 */

export type CardKind = "intro" | "outro";

export type CardCommandInput = {
  kind: CardKind;
  plan: RenderPlan;
  target: RenderTarget;
  encoding: EncodingProfile;
  mode: EncodingMode;
  durationInSeconds: number;
  outputPath: string;
  /** Bestand met de tekst; `null` = een kaart zonder tekst. */
  textFilePath: string | null;
  fontPath: string | null;
};

export type CardCommand = {
  args: string[];
  frames: number;
  durationInSeconds: number;
  chain: string;
};

export function buildCardCommand(input: CardCommandInput): CardCommand {
  const { plan, target, encoding, mode } = input;
  const frames = Math.max(Math.round(input.durationInSeconds * target.fps), 1);
  const background = toFfmpegColor(plan.brand.primaryColor);
  const foreground = toFfmpegColor(plan.brand.onPrimaryColor);

  const filters: string[] = [];

  if (input.textFilePath && input.fontPath) {
    filters.push(
      ...textCardFilters({
        textFilePath: input.textFilePath,
        fontPath: input.fontPath,
        color: foreground,
        fontSize: cardFontSize(input.kind, target),
        centerY: 0.5,
      }),
    );
  }

  // Dezelfde afsluiting als bij een scène: `xfade` verbindt alleen clips met
  // hetzelfde pixelformaat en dezelfde pixelverhouding.
  filters.push("format=yuv420p", "setsar=1");

  const chain = filters.join(",");

  const args = [
    // `color` is een bron zonder bestand: FFmpeg maakt het vlak zelf, precies
    // even lang en op precies de framerate die de rest van de video heeft.
    "-f",
    "lavfi",
    "-i",
    `color=c=${background}:s=${target.size}:r=${target.fps}:d=${input.durationInSeconds.toFixed(3)}`,
    "-vf",
    chain,
    "-frames:v",
    String(frames),
    "-an",
    ...videoEncodingArgs(encoding, target, mode),
    input.outputPath,
  ];

  return { args, frames, durationInSeconds: input.durationInSeconds, chain };
}

/* -------------------------------------------------------------------------
 * Tekst die past
 * ---------------------------------------------------------------------- */

/**
 * De teksthoogte van een kaart.
 *
 * De titel mag groter dan de contactgegevens: die eerste is de kop, de tweede
 * zijn twee regels eronder. Maar niet alleen de hoogte telt mee — op een
 * staande 1080x1920 is 7,5 % van de hoogte breder dan het beeld zelf aankan.
 * Vandaar het plafond op de breedte.
 */
export const CARD_FONT_SCALE: Record<CardKind, { height: number; width: number }> = {
  intro: { height: 0.075, width: 0.1 },
  outro: { height: 0.055, width: 0.075 },
};

export function cardFontSize(kind: CardKind, target: RenderTarget): number {
  const scale = CARD_FONT_SCALE[kind];

  return Math.round(Math.min(target.height * scale.height, target.width * scale.width));
}

/**
 * De tekst over regels verdelen zodat ze in beeld past.
 *
 * `drawtext` breekt zelf niets af: een titel die te breed is, loopt gewoon het
 * kader uit. De breedte van een letter is niet op te vragen in een expressie
 * (en `fontsize` naar de tekstbreedte laten kijken zou een cirkel zijn), dus
 * schatten we: in Arial en verwanten is een teken gemiddeld iets meer dan een
 * halve `fontsize` breed. Liever een regel te vroeg afgebroken dan een titel
 * die half buiten beeld valt.
 */
export function wrapCardText(text: string, kind: CardKind, target: RenderTarget): string {
  const perLine = Math.max(Math.floor((target.width * 0.84) / (cardFontSize(kind, target) * 0.52)), 8);

  return text
    .split("\n")
    .map((line) => wrapLine(line.trim(), perLine))
    .join("\n");
}

function wrapLine(line: string, perLine: number): string {
  const lines: string[] = [];
  let current = "";

  for (const word of line.split(/\s+/).filter(Boolean)) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= perLine) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines.join("\n");
}

/** Wat er op de introkaart komt: de titel van het project. */
export function introCardText(plan: RenderPlan): string | null {
  const title = plan.title.trim();

  return title.length > 0 ? title : null;
}

/**
 * Wat er op de eindkaart komt, in dezelfde volgorde als in de preview op de
 * instellingenpagina: de vraag, de oproep, de naam, en dan hoe je het kantoor
 * bereikt.
 *
 * Elke regel komt uit de huisstijl van het kantoor of uit wat dit project
 * daarvan overruled heeft — `resolveBrand()` heeft dat verschil hiervoor al
 * weggewerkt. Is alles leeg, dan wordt het een vlak in de huisstijlkleur; dat
 * is eerlijker dan een kaart met half ingevulde tekst.
 */
export function outroCardText(plan: RenderPlan): string | null {
  const lines = [
    plan.brand.outroText,
    plan.brand.ctaText,
    plan.brand.contact.agentName,
    ...contactLines(plan.brand),
  ]
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * `#0f5f57` -> `0x0f5f57`. FFmpeg kent hex met `0x` en kleurnamen; een
 * hekje is in een filterstring niets bijzonders maar op een opdrachtregel wel.
 */
export function toFfmpegColor(color: string): string {
  const hex = color.trim().replace(/^#/, "");

  return /^[0-9a-f]{6}$/i.test(hex) ? `0x${hex.toLowerCase()}` : "black";
}
