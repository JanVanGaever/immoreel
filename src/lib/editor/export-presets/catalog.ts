import {
  SAFE_AREA_FACEBOOK,
  SAFE_AREA_INSTAGRAM_FEED,
  SAFE_AREA_INSTAGRAM_REELS,
  SAFE_AREA_LINKEDIN,
  SAFE_AREA_TIKTOK,
  SAFE_AREA_WEBSITE,
  SAFE_AREA_WHATSAPP,
} from "@/lib/editor/export-presets/safe-areas";
import type {
  AspectRatio,
  ExportPlatform,
  ExportPlatformInfo,
  ExportPreset,
  ID,
  ProjectGoal,
} from "@/types";

/**
 * De catalogus: welke platformen er zijn en welke bestanden we voor elk maken.
 *
 * Dit is het enige bestand dat je aanraakt om een platform toe te voegen. Zet
 * er een regel bij in `EXPORT_PLATFORMS` en één of meer in `EXPORT_PRESETS`, en
 * het platform verschijnt in de editor, in de waarschuwingen, in de
 * bestandsnamen en in de wachtrij. Alleen als het bijzondere eisen aan de
 * encoder stelt komt er nog één regel bij in `PLATFORM_ENCODING`
 * (`src/workers/render/ffmpeg/config.ts`).
 *
 * De volgorde hier is de volgorde in de editor: van je eigen kanaal, over
 * sociale media, naar rechtstreeks versturen.
 */

const MB = 1024 * 1024;

export const EXPORT_PLATFORMS: ExportPlatformInfo[] = [
  {
    id: "website",
    label: "Website",
    description: "Je eigen zoekertje, een e-mail of een scherm in het kantoor.",
    fileSlug: "website",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Zakelijke tijdlijn: sober beeld, de tekst doet het werk.",
    fileSlug: "linkedin",
  },
  {
    id: "facebook",
    label: "Facebook",
    description: "Tijdlijn en groepen; ook de plek waar je een bericht sponsort.",
    fileSlug: "facebook",
  },
  {
    id: "instagram-feed",
    label: "Instagram Feed",
    description: "Het raster van je profiel en de gewone tijdlijn.",
    fileSlug: "instagram-feed",
  },
  {
    id: "instagram-reels",
    label: "Instagram Reels",
    description: "Schermvullend en staand; bereikt ook wie je nog niet volgt.",
    fileSlug: "instagram-reels",
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "Kort en snel: de eerste seconde beslist of iemand blijft kijken.",
    fileSlug: "tiktok",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Rechtstreeks naar een kandidaat-koper, of als status.",
    fileSlug: "whatsapp",
  },
];

const PLATFORMS_BY_ID = new Map(EXPORT_PLATFORMS.map((platform) => [platform.id, platform]));

export function findExportPlatform(platform: ExportPlatform): ExportPlatformInfo | null {
  return PLATFORMS_BY_ID.get(platform) ?? null;
}

export function exportPlatformLabel(platform: ExportPlatform): string {
  return PLATFORMS_BY_ID.get(platform)?.label ?? platform;
}

/* -------------------------------------------------------------------------
 * De presets
 * ---------------------------------------------------------------------- */

/**
 * Wat je per preset invult; de rest is voor iedereen hetzelfde.
 *
 * 30 fps, MP4 en 128 kbit/s geluid gelden overal, en een preset die daarvan
 * afwijkt zegt dat expliciet. Zo staat er in de lijst hieronder alleen wat een
 * platform bijzonder maakt, in plaats van tien keer dezelfde vier regels.
 */
type PresetInput = Pick<
  ExportPreset,
  "platform" | "label" | "description" | "aspectRatio" | "width" | "height" | "videoBitrateKbps" | "safeArea"
> &
  Partial<
    Pick<
      ExportPreset,
      | "fps"
      | "container"
      | "audioBitrateKbps"
      | "maxDurationInSeconds"
      | "minDurationInSeconds"
      | "recommendedDuration"
      | "maxFileSizeInBytes"
    >
  >;

/** De id volgt uit platform en verhouding: instagram-reels-9x16. */
function buildPresetId(platform: ExportPlatform, ratio: AspectRatio): ID {
  return `${platform}-${ratio.replace(":", "x")}`;
}

function definePreset(input: PresetInput): ExportPreset {
  return {
    id: buildPresetId(input.platform, input.aspectRatio),
    fps: 30,
    container: "mp4",
    audioBitrateKbps: 128,
    maxDurationInSeconds: null,
    minDurationInSeconds: null,
    recommendedDuration: null,
    maxFileSizeInBytes: null,
    ...input,
  };
}

export const EXPORT_PRESETS: ExportPreset[] = [
  definePreset({
    platform: "website",
    label: "Website — 16:9",
    description: "1080p liggend, de hoogste kwaliteit die we maken.",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 192,
    recommendedDuration: { minInSeconds: 45, maxInSeconds: 150 },
    safeArea: SAFE_AREA_WEBSITE,
  }),
  definePreset({
    platform: "linkedin",
    label: "LinkedIn — vierkant",
    description: "1:1; neemt meer plaats in een tijdlijn dan liggend beeld.",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    videoBitrateKbps: 5000,
    maxDurationInSeconds: 600,
    minDurationInSeconds: 3,
    recommendedDuration: { minInSeconds: 30, maxInSeconds: 90 },
    safeArea: SAFE_AREA_LINKEDIN,
  }),
  definePreset({
    platform: "linkedin",
    label: "LinkedIn — liggend",
    description: "16:9; dezelfde video als op je site, zonder bij te snijden.",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    videoBitrateKbps: 6000,
    maxDurationInSeconds: 600,
    minDurationInSeconds: 3,
    recommendedDuration: { minInSeconds: 30, maxInSeconds: 90 },
    safeArea: SAFE_AREA_LINKEDIN,
  }),
  definePreset({
    platform: "facebook",
    label: "Facebook — vierkant",
    description: "1:1; werkt even goed op een telefoon als op een laptop.",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    videoBitrateKbps: 5000,
    maxDurationInSeconds: 600,
    minDurationInSeconds: 3,
    recommendedDuration: { minInSeconds: 20, maxInSeconds: 60 },
    safeArea: SAFE_AREA_FACEBOOK,
  }),
  definePreset({
    platform: "facebook",
    label: "Facebook — portret",
    description: "4:5; vult meer van het scherm bij wie op de telefoon scrollt.",
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    videoBitrateKbps: 5000,
    maxDurationInSeconds: 600,
    minDurationInSeconds: 3,
    recommendedDuration: { minInSeconds: 20, maxInSeconds: 60 },
    safeArea: SAFE_AREA_FACEBOOK,
  }),
  definePreset({
    platform: "instagram-feed",
    label: "Instagram Feed — vierkant",
    description: "1:1; blijft in je profielraster staan zoals je het maakt.",
    aspectRatio: "1:1",
    width: 1080,
    height: 1080,
    videoBitrateKbps: 5000,
    maxDurationInSeconds: 600,
    minDurationInSeconds: 3,
    recommendedDuration: { minInSeconds: 20, maxInSeconds: 60 },
    safeArea: SAFE_AREA_INSTAGRAM_FEED,
  }),
  definePreset({
    platform: "instagram-feed",
    label: "Instagram Feed — portret",
    description: "4:5; het hoogste formaat dat de feed toelaat.",
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
    videoBitrateKbps: 5000,
    maxDurationInSeconds: 600,
    minDurationInSeconds: 3,
    recommendedDuration: { minInSeconds: 20, maxInSeconds: 60 },
    safeArea: SAFE_AREA_INSTAGRAM_FEED,
  }),
  definePreset({
    platform: "instagram-reels",
    label: "Instagram Reels — 9:16",
    description: "Schermvullend staand. Let op de knoppen rechts en onderaan.",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    videoBitrateKbps: 6000,
    maxDurationInSeconds: 180,
    minDurationInSeconds: 3,
    recommendedDuration: { minInSeconds: 15, maxInSeconds: 60 },
    safeArea: SAFE_AREA_INSTAGRAM_REELS,
  }),
  definePreset({
    platform: "tiktok",
    label: "TikTok — 9:16",
    description: "Staand, met een hogere bitrate omdat TikTok stevig hercomprimeert.",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    videoBitrateKbps: 7000,
    maxDurationInSeconds: 600,
    minDurationInSeconds: 3,
    recommendedDuration: { minInSeconds: 15, maxInSeconds: 60 },
    safeArea: SAFE_AREA_TIKTOK,
  }),
  definePreset({
    platform: "whatsapp",
    label: "WhatsApp — 9:16",
    description: "Staand en licht: klein genoeg om zonder gedoe te versturen.",
    aspectRatio: "9:16",
    width: 720,
    height: 1280,
    videoBitrateKbps: 2500,
    audioBitrateKbps: 96,
    recommendedDuration: { minInSeconds: 15, maxInSeconds: 45 },
    // WhatsApp weigert grote bestanden in een gesprek. Dat is hier de echte
    // grens, niet de lengte: een korte video op hoge bitrate loopt er even
    // hard tegenaan als een lange.
    maxFileSizeInBytes: 16 * MB,
    safeArea: SAFE_AREA_WHATSAPP,
  }),
];

const PRESETS_BY_ID = new Map(EXPORT_PRESETS.map((preset) => [preset.id, preset]));

export function findExportPreset(presetId: ID): ExportPreset | null {
  return PRESETS_BY_ID.get(presetId) ?? resolveLegacyPreset(presetId);
}

export function isExportPresetId(value: unknown): value is ID {
  return typeof value === "string" && findExportPreset(value) !== null;
}

/** De presets van één platform, in catalogusvolgorde. */
export function presetsForPlatform(platform: ExportPlatform): ExportPreset[] {
  return EXPORT_PRESETS.filter((preset) => preset.platform === platform);
}

/** De presets die exact bij deze beeldverhouding passen; daar wordt niets bijgesneden. */
export function presetsForRatio(ratio: AspectRatio): ExportPreset[] {
  return EXPORT_PRESETS.filter((preset) => preset.aspectRatio === ratio);
}

export type PlatformGroup = {
  platform: ExportPlatformInfo;
  presets: ExportPreset[];
};

/** Alle presets gegroepeerd per platform — de vorm die de editor tekent. */
export function groupPresetsByPlatform(): PlatformGroup[] {
  return EXPORT_PLATFORMS.map((platform) => ({
    platform,
    presets: presetsForPlatform(platform.id),
  })).filter((group) => group.presets.length > 0);
}

/* -------------------------------------------------------------------------
 * Wat er standaard aangevinkt staat
 * ---------------------------------------------------------------------- */

/**
 * Van het doel uit de wizard naar de eerste export.
 *
 * Vroeger hadden doel en preset dezelfde id en was dit één regel. Dat kon niet
 * blijven duren: Instagram is nu twee platformen en LinkedIn twee formaten.
 * Deze tabel maakt van die koppeling weer een keuze, in plaats van iets dat
 * werkte omdat twee lijsten toevallig dezelfde woorden gebruikten.
 */
const GOAL_PRESETS: Record<ProjectGoal, ID[]> = {
  website: ["website-16x9"],
  linkedin: ["linkedin-1x1"],
  instagram: ["instagram-reels-9x16"],
  tiktok: ["tiktok-9x16"],
  whatsapp: ["whatsapp-9x16"],
};

export function defaultPresetIdsForGoal(goal: ProjectGoal | null | undefined): ID[] {
  if (!goal) return [];

  return [...(GOAL_PRESETS[goal] ?? [])];
}

/**
 * Wat we voorstellen als we alleen de beeldverhouding van het project kennen:
 * de presets die precies passen. Is er geen enkele, dan de website-export —
 * die kan altijd, en bijsnijden naar liggend is de minst schadelijke stap.
 */
export function suggestedPresetIds(ratio: AspectRatio): ID[] {
  const matching = presetsForRatio(ratio);

  return matching.length > 0 ? matching.map((preset) => preset.id) : ["website-16x9"];
}

/* -------------------------------------------------------------------------
 * Oude ids
 * ---------------------------------------------------------------------- */

/**
 * Projecten van vóór deze catalogus bewaarden één id per platform
 * (`instagram`, `linkedin`). Die blijven werken: ze wijzen naar de preset die
 * er toen achter zat. Zo hoeft er aan bestaande projecten niets gewijzigd te
 * worden en verdwijnt een aangevinkt platform niet stilletjes uit de editor.
 */
const LEGACY_PRESET_IDS: Record<string, ID> = {
  website: "website-16x9",
  linkedin: "linkedin-1x1",
  instagram: "instagram-reels-9x16",
  tiktok: "tiktok-9x16",
  whatsapp: "whatsapp-9x16",
};

function resolveLegacyPreset(presetId: ID): ExportPreset | null {
  const current = LEGACY_PRESET_IDS[presetId];

  return current ? (PRESETS_BY_ID.get(current) ?? null) : null;
}

/**
 * Een bewaarde lijst opschonen: oude ids worden nieuwe, onbekende ids vallen
 * weg en dubbels verdwijnen. Alles wat een lijst preset-ids binnenkrijgt — de
 * editor, de validatie, de serveractie — laat ze hier eerst door.
 */
export function normaliseExportPresetIds(value: unknown): ID[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<ID>();

  for (const entry of value) {
    const preset = typeof entry === "string" ? findExportPreset(entry) : null;
    if (preset) seen.add(preset.id);
  }

  // In catalogusvolgorde, niet in aanvinkvolgorde: dan staat de lijst in het
  // exportvenster altijd in dezelfde volgorde als de selectie erboven.
  return EXPORT_PRESETS.filter((preset) => seen.has(preset.id)).map((preset) => preset.id);
}
