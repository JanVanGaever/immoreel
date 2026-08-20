import type { ID } from "@/types/common";
import type { AspectRatio } from "@/types/video";

/**
 * De vorm van een exportpreset: waar een video naartoe gaat en hoe ze daar
 * uit moet zien.
 *
 * Deze types staan bewust in `types/` en niet naast de presetlijst zelf. Ze
 * worden op drie plaatsen gelezen die niets met elkaar te maken hebben — de
 * editor (kiezen), de serveractie (aanvragen) en de renderworker (encoderen) —
 * en geen van die drie hoort de andere twee mee te slepen. Om dezelfde reden
 * zit er geen icoon in: dat is beeld voor de editor, en een worker die een
 * bestand encodeert heeft geen React-component nodig.
 */

/**
 * De platformen waarvoor we exporteren.
 *
 * Een platform is niet hetzelfde als een preset: Instagram Feed en Instagram
 * Reels stellen andere eisen en tellen dus als twee platformen, terwijl één
 * platform meerdere beeldverhoudingen kan hebben (LinkedIn 1:1 én 16:9).
 * Wat hier per platform vastligt — naam, bestandsnaam, encoderinstellingen —
 * geldt voor al zijn presets.
 */
export type ExportPlatform =
  | "website"
  | "linkedin"
  | "facebook"
  | "instagram-feed"
  | "instagram-reels"
  | "tiktok"
  | "whatsapp";

export type ExportContainer = "mp4";

/**
 * Welke rand van het beeld je niet mag vertrouwen.
 *
 * Elk platform legt zijn eigen knoppen over de video: een gebruikersnaam
 * onderaan, een kolom met hartjes en delen rechts, een statusbalk bovenaan.
 * Wat daar staat — een prijs, een adres, een telefoonnummer — is in de app
 * perfect leesbaar en in de tijdlijn van het platform half bedekt.
 *
 * De waarden zijn fracties van breedte en hoogte (0 tot 1) en geen pixels,
 * zodat dezelfde zone klopt in 1080x1920 en in 720x1280. `safeAreaInsets()`
 * rekent ze om zodra er wél een concreet formaat is.
 */
export type SafeArea = {
  topFraction: number;
  rightFraction: number;
  bottomFraction: number;
  leftFraction: number;
  /** Waarom die randen vrij moeten blijven, in gewone taal. */
  hints: string[];
};

/** Duurgrens die het platform zelf niet oplegt, maar die in de praktijk werkt. */
export type DurationRange = {
  minInSeconds: number;
  maxInSeconds: number;
};

/**
 * Eén exportdoel: alles wat de renderpijplijn nodig heeft om een bestand te
 * maken, plus alles wat de editor nodig heeft om te waarschuwen vóór dat
 * gebeurt. Er staat niets in dat pas tijdens het renderen bekend is.
 */
export type ExportPreset = {
  id: ID;
  platform: ExportPlatform;
  /** Wat er in de editor staat: "LinkedIn — vierkant". */
  label: string;
  /** Eén zin over wanneer je deze kiest. */
  description: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  fps: number;
  /** Videobitrate in kbit/s; het plafond, niet de vaste snelheid (zie de encoder). */
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  container: ExportContainer;
  /** Wat het platform weigert; `null` als er geen harde grens is. */
  maxDurationInSeconds: number | null;
  /** Onder deze lengte valt de video op het platform uit de boot. */
  minDurationInSeconds: number | null;
  /** Waar de video het best werkt. Geen grens: hoogstens een opmerking. */
  recommendedDuration: DurationRange | null;
  /** Bestandsgrens van het platform; `null` als er geen praktische grens is. */
  maxFileSizeInBytes: number | null;
  safeArea: SafeArea;
};

/** Wat er per platform vastligt, los van de beeldverhouding. */
export type ExportPlatformInfo = {
  id: ExportPlatform;
  label: string;
  description: string;
  /** Het stuk dat in de bestandsnaam terechtkomt: `instagram-reels`. */
  fileSlug: string;
};

/** Waarom een export nu niet, of niet helemaal, gaat lukken. */
export type ExportWarningCode =
  | "andere-verhouding"
  | "te-lang"
  | "te-kort"
  | "buiten-aanbeveling"
  | "te-zwaar"
  | "geen-scenes";

export type ExportWarning = {
  /** Leeg wanneer de waarschuwing over de hele batch gaat en niet over één preset. */
  presetId: ID;
  code: ExportWarningCode;
  /** `blokkerend` houdt de export tegen; `let-op` is een opmerking. */
  level: "let-op" | "blokkerend";
  message: string;
};

/** Eén export uit een batch: welke preset, welk bestand, wat er mis kan zijn. */
export type ExportItem = {
  preset: ExportPreset;
  /** De naam waaronder dit bestand gedownload wordt. */
  fileName: string;
  estimatedSizeInBytes: number;
  warnings: ExportWarning[];
};

/**
 * Wat er gebeurt als je nu op exporteren duwt: alle gekozen presets samen,
 * met per stuk een bestandsnaam en een oordeel, en in het geheel of het
 * überhaupt kan.
 */
export type ExportBatch = {
  items: ExportItem[];
  /** Gekozen ids die geen preset (meer) zijn; bijvoorbeeld uit een oud project. */
  unknownPresetIds: ID[];
  warnings: ExportWarning[];
  blocking: ExportWarning[];
  totalEstimatedSizeInBytes: number;
  canExport: boolean;
};
