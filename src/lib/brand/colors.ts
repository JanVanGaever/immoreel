/**
 * Kleurhulp voor de huisstijl.
 *
 * Twee vragen komen steeds terug: is dit een geldige hex, en welke tekstkleur
 * blijft daarop leesbaar? Beide worden hier één keer beantwoord, zodat de
 * preview in de browser en de kaart die FFmpeg tekent tot dezelfde kleur
 * komen. Er zit bewust geen kleurbibliotheek achter — dit is alles wat we
 * nodig hebben.
 */

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value.trim());
}

/**
 * "0f5f57", "#0F5F57" en "#0f5" worden allemaal `#0f5f57`. Geeft `null` bij
 * iets wat geen kleur is, zodat de validatie het verschil ziet tussen "fout
 * ingevuld" en "leeg gelaten".
 */
export function normaliseHex(value: string): string | null {
  const match = HEX_PATTERN.exec(value.trim());
  if (!match) return null;

  const digits = match[1]!.toLowerCase();
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;

  return `#${full}`;
}

type Rgb = { r: number; g: number; b: number };

function toRgb(hex: string): Rgb {
  const normalised = normaliseHex(hex) ?? "#000000";

  return {
    r: Number.parseInt(normalised.slice(1, 3), 16),
    g: Number.parseInt(normalised.slice(3, 5), 16),
    b: Number.parseInt(normalised.slice(5, 7), 16),
  };
}

/** Relatieve luminantie volgens WCAG 2.1. */
function luminance(hex: string): number {
  const { r, g, b } = toRgb(hex);

  const channel = (value: number) => {
    const scaled = value / 255;

    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrastverhouding tussen twee kleuren, van 1 (gelijk) tot 21 (zwart-wit). */
export function contrastRatio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * De tekstkleur die op dit vlak leesbaar blijft.
 *
 * Wit of bijna-zwart, niets ertussen: een makelaar kiest een huisstijlkleur,
 * niet de kleur van de letters erop. Welke van de twee het wordt, is geen
 * smaakkwestie maar het hoogste contrast.
 */
export function onColor(background: string): string {
  const dark = "#101828";

  return contrastRatio(background, "#ffffff") >= contrastRatio(background, dark)
    ? "#ffffff"
    : dark;
}

/** WCAG AA voor grote tekst; dat is wat er op een titelkaart staat. */
export const MIN_CONTRAST_LARGE_TEXT = 3;

/**
 * Of deze twee kleuren naast elkaar nog uit elkaar te houden zijn. De
 * secundaire kleur ligt op de primaire (een knop op de eindkaart), dus vallen
 * ze samen, dan is de oproep onzichtbaar.
 */
export function hasEnoughContrast(a: string, b: string): boolean {
  return contrastRatio(a, b) >= MIN_CONTRAST_LARGE_TEXT;
}
