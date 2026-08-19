import type { AspectRatio } from "@/types";

/**
 * Eén bron van waarheid voor de beeldverhoudingen: label, uitleg en de
 * CSS-waarde voor een voorbeeldkader. De wizard, de editor en de projectlijst
 * noemen "9:16" zo overal hetzelfde.
 */

export type AspectRatioOption = {
  id: AspectRatio;
  /** Kort, naast het formaat zelf: "Liggend". */
  label: string;
  description: string;
};

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {
    id: "16:9",
    label: "Liggend",
    description: "Website, YouTube en presentaties op een groot scherm.",
  },
  {
    id: "9:16",
    label: "Staand",
    description: "Reels, TikTok en status: vult een telefoonscherm volledig.",
  },
  {
    id: "1:1",
    label: "Vierkant",
    description: "Veilige keuze in een tijdlijn; werkt op elk platform.",
  },
  {
    id: "4:5",
    label: "Portret",
    description: "Iets hoger dan vierkant; neemt meer plaats in een feed.",
  },
];

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  "16:9": "16:9 — liggend",
  "9:16": "9:16 — staand",
  "1:1": "1:1 — vierkant",
  "4:5": "4:5 — portret",
};

/** "16:9" -> "16 / 9", bruikbaar als CSS `aspect-ratio`. */
export function aspectRatioCss(ratio: AspectRatio): string {
  return ratio.replace(":", " / ");
}
