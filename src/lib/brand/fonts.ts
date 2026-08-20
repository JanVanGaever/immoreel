import type { BrandFontId } from "@/types";

/**
 * De lettertypes waaruit een kantoor kan kiezen.
 *
 * Bewust een korte lijst en geen vrije invoer. Elk lettertype hier moet twee
 * dingen kunnen: in de browser getoond worden (`stack`) én door FFmpeg op een
 * kaart getekend worden (`fileName`). Een naam die de renderserver niet in
 * huis heeft, levert een video op die er anders uitziet dan de preview — en
 * dat is precies wat deze module moet voorkomen.
 *
 * De bestanden staan naast het lettertype uit `RENDER_FONT_PATH`; ontbreekt er
 * een, dan valt de render terug op dat standaardbestand (zie `cards.ts`).
 */

export type BrandFontCategory = "schreefloos" | "schreef";

export type BrandFont = {
  id: BrandFontId;
  label: string;
  /** Waar het bij past, in één regel. Staat onder de keuze in het formulier. */
  description: string;
  category: BrandFontCategory;
  /** CSS `font-family`, met vangnetten die op elk systeem bestaan. */
  stack: string;
  /** Bestandsnaam voor `drawtext`; zie `renderFontPath()`. */
  fileName: string;
};

export const BRAND_FONTS: BrandFont[] = [
  {
    id: "inter",
    label: "Inter",
    description: "Neutraal en modern. De veilige keuze voor elk kantoor.",
    category: "schreefloos",
    stack: 'Inter, ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
    fileName: "Inter-SemiBold.ttf",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    description: "Ronder en vriendelijker; werkt goed bij starterswoningen.",
    category: "schreefloos",
    stack: '"DM Sans", ui-rounded, ui-sans-serif, system-ui, sans-serif',
    fileName: "DMSans-Bold.ttf",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    description: "Uitgesproken en technisch. Valt op tussen de rest.",
    category: "schreefloos",
    stack: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    fileName: "SpaceGrotesk-Bold.ttf",
  },
  {
    id: "source-serif",
    label: "Source Serif",
    description: "Schreefletter met een zakelijke toon; past bij herenhuizen.",
    category: "schreef",
    stack: '"Source Serif 4", ui-serif, Georgia, "Times New Roman", serif',
    fileName: "SourceSerif4-SemiBold.ttf",
  },
  {
    id: "libre-baskerville",
    label: "Libre Baskerville",
    description: "Klassiek en rustig. Het duurdere segment.",
    category: "schreef",
    stack: '"Libre Baskerville", ui-serif, Georgia, "Times New Roman", serif',
    fileName: "LibreBaskerville-Bold.ttf",
  },
];

export const DEFAULT_FONT_ID: BrandFontId = "inter";

export function findFont(fontId: BrandFontId | null | undefined): BrandFont {
  return BRAND_FONTS.find((font) => font.id === fontId) ?? BRAND_FONTS[0]!;
}

export function fontStack(fontId: BrandFontId | null | undefined): string {
  return findFont(fontId).stack;
}

export function isBrandFontId(value: unknown): value is BrandFontId {
  return typeof value === "string" && BRAND_FONTS.some((font) => font.id === value);
}
