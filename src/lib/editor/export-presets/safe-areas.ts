import type { ExportPreset, SafeArea } from "@/types";

/**
 * De zones die elk platform over je video legt.
 *
 * Ze staan hier apart en niet bij elke preset, omdat ze per platform gelden en
 * niet per beeldverhouding: LinkedIn zet dezelfde balk onder een vierkante en
 * onder een liggende video. Zo staat elke zone één keer beschreven, en past een
 * platform dat zijn interface wijzigt in één plek aan.
 *
 * De getallen zijn geen exacte metingen van een app-versie — die zijn morgen
 * anders. Het zijn ruime marges: wie erbinnen blijft, blijft leesbaar, ook na
 * de volgende update van het platform.
 */

function safeArea(input: Partial<SafeArea> & { hints: string[] }): SafeArea {
  return {
    topFraction: 0,
    rightFraction: 0,
    bottomFraction: 0,
    leftFraction: 0,
    ...input,
  };
}

/** Een eigen speler op je site: alleen de bedieningsbalk komt eroverheen. */
export const SAFE_AREA_WEBSITE = safeArea({
  bottomFraction: 0.1,
  leftFraction: 0.04,
  rightFraction: 0.04,
  hints: [
    "De onderste 10% valt achter de bedieningsbalk van de speler zodra iemand de muis beweegt.",
    "Houd adres en prijs weg bij de randen: een speler die vollediger schermvullend speelt, snijdt daar iets af.",
  ],
});

/** Zakelijke tijdlijn: naam van de poster boven, reacties en knoppen onder. */
export const SAFE_AREA_LINKEDIN = safeArea({
  topFraction: 0.08,
  bottomFraction: 0.16,
  leftFraction: 0.05,
  rightFraction: 0.05,
  hints: [
    "Onderaan staan de knoppen en het begin van je tekst; reken op de onderste 16%.",
    "Bovenaan schuift de naam van het kantoor mee in beeld bij het scrollen.",
  ],
});

export const SAFE_AREA_FACEBOOK = safeArea({
  topFraction: 0.08,
  bottomFraction: 0.18,
  leftFraction: 0.05,
  rightFraction: 0.05,
  hints: [
    "De onderste 18% gaat schuil achter de tekst van het bericht en de reactieknoppen.",
    "Bij een advertentie komt daar nog een knop bij; zet je call-to-action dus niet onderin het beeld.",
  ],
});

export const SAFE_AREA_INSTAGRAM_FEED = safeArea({
  topFraction: 0.06,
  bottomFraction: 0.16,
  leftFraction: 0.05,
  rightFraction: 0.05,
  hints: [
    "Onder de video staan gebruikersnaam en bijschrift; in de feed bedekken die de onderste rand.",
    "Bij 4:5 is de kans het grootst dat iemand de video schermvullend opent — houd de randen daar rustig.",
  ],
});

/** Staand en volledig scherm: dit is de zwaarste zone van allemaal. */
export const SAFE_AREA_INSTAGRAM_REELS = safeArea({
  topFraction: 0.12,
  bottomFraction: 0.3,
  rightFraction: 0.2,
  leftFraction: 0.05,
  hints: [
    "De onderste 30% is van Instagram: gebruikersnaam, bijschrift en de muziekbalk staan daar.",
    "Rechts loopt de kolom met hartje, reactie en delen over ongeveer een vijfde van de breedte.",
    "Bovenaan zit de statusbalk van de telefoon; zet er geen logo of prijs in.",
  ],
});

export const SAFE_AREA_TIKTOK = safeArea({
  topFraction: 0.1,
  bottomFraction: 0.28,
  rightFraction: 0.22,
  leftFraction: 0.05,
  hints: [
    "Onderaan staan naam, bijschrift en de muziektitel: reken op ruim een kwart van de hoogte.",
    "Rechts staat de knoppenkolom, met daaronder het draaiende plaatje van de muziek.",
    "TikTok toont de eerste seconde als omslag; zet daar geen tekst die halverwege wegvalt.",
  ],
});

/** Verstuurd in een gesprek of als status; beide hebben een lichte interface. */
export const SAFE_AREA_WHATSAPP = safeArea({
  topFraction: 0.1,
  bottomFraction: 0.14,
  leftFraction: 0.05,
  rightFraction: 0.05,
  hints: [
    "Als status heeft de video bovenaan een voortgangsbalk en onderaan een antwoordveld.",
    "In een gesprek wordt de video kleiner getoond: kleine tekst is dan niet meer te lezen.",
  ],
});

/* -------------------------------------------------------------------------
 * Rekenen met een zone
 * ---------------------------------------------------------------------- */

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/** De zone in pixels van dit formaat, afgerond op hele pixels. */
export function safeAreaInsets(preset: ExportPreset): SafeAreaInsets {
  const { safeArea: zone, width, height } = preset;

  return {
    top: Math.round(zone.topFraction * height),
    right: Math.round(zone.rightFraction * width),
    bottom: Math.round(zone.bottomFraction * height),
    left: Math.round(zone.leftFraction * width),
  };
}

/**
 * Het rechthoekje dat wél veilig is, in pixels. Hiermee kan de editor later een
 * kader over de preview leggen; nu is het vooral wat de cijfers in het venster
 * onderbouwt.
 */
export function safeAreaRect(preset: ExportPreset): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const insets = safeAreaInsets(preset);

  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(preset.width - insets.left - insets.right, 0),
    height: Math.max(preset.height - insets.top - insets.bottom, 0),
  };
}

/** Hoeveel van het beeld overblijft, van 0 tot 1. Onder 0.5 is het dringen. */
export function safeAreaCoverage(preset: ExportPreset): number {
  const rect = safeAreaRect(preset);

  return (rect.width * rect.height) / (preset.width * preset.height);
}

/** Korte samenvatting voor naast de preset: "veilig midden: 1026x1152". */
export function describeSafeArea(preset: ExportPreset): string {
  const rect = safeAreaRect(preset);

  return `Veilig midden ${rect.width}x${rect.height} (${Math.round(safeAreaCoverage(preset) * 100)}% van het beeld)`;
}
