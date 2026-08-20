import type { ExportPreset, ID } from "@/types";
import { findExportPlatform } from "@/lib/editor/export-presets/catalog";

/**
 * Hoe een export heet als ze op de computer van de makelaar staat.
 *
 * Dit is geen detail. Wie voor één pand naar vijf platformen exporteert, heeft
 * straks vijf MP4-bestanden in dezelfde downloadmap, en `render-3.mp4` zegt op
 * dat moment niets meer. De naam moet daarom drie dingen vertellen zonder dat
 * je het bestand opent: welk pand, welk platform, welk formaat.
 *
 *   vk-2043-zonnestraat-12-gent-instagram-reels-1080x1920.mp4
 *
 * Bewust géén datum of tijdstip in de naam. Twee keer hetzelfde exporteren
 * levert dan hetzelfde bestand op, dat het vorige vervangt in plaats van er een
 * bijna-identieke tweede naast te zetten — dezelfde gedachte als de
 * jobsleutels in `src/lib/render/fingerprint.ts`. Wie de datum toch wil, zet
 * `date` mee.
 */

export type ExportFileNameInput = {
  /** Titel van het project; de kern van de naam. */
  title: string;
  /** Referentie van het pand zoals het kantoor die kent, bv. "VK-2043". */
  reference?: string | null;
  city?: string | null;
  /** Alleen invullen wanneer de datum in de naam moet; standaard niet. */
  date?: Date | null;
};

/** De losse accenttekens (U+0300 tot U+036F) die `NFKD` van een letter afsplitst. */
const COMBINING_MARKS = new RegExp("[\u0300-\u036f]", "g");

/** Geen naamdeel langer dan dit; anders wordt de volledige naam onwerkbaar. */
const MAX_TITLE_SLUG = 48;

/**
 * Naar iets dat op elk bestandssysteem mag staan: kleine letters, cijfers en
 * koppeltekens. Accenten worden hun gewone letter (Sint-Genesius-Rode blijft
 * leesbaar), al de rest valt weg.
 */
export function slugify(value: string, maxLength = MAX_TITLE_SLUG): string {
  const slug = value
    .normalize("NFKD")
    // De losse accenttekens die `NFKD` achterlaat.
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length <= maxLength) return slug;

  // Afkappen op een koppelteken, zodat er geen half woord overblijft.
  const cut = slug.slice(0, maxLength);
  const lastDash = cut.lastIndexOf("-");

  return (lastDash > maxLength / 2 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

function formatDatePart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

/**
 * De naam van één export. De onderdelen staan in de volgorde waarin je ernaar
 * zoekt: eerst het pand (referentie, titel, gemeente), dan het platform, dan
 * het formaat.
 */
export function buildExportFileName(preset: ExportPreset, input: ExportFileNameInput): string {
  const platform = findExportPlatform(preset.platform);
  const title = slugify(input.title) || "video";
  const city = slugify(input.city ?? "", 24);

  const parts = [
    slugify(input.reference ?? "", 16),
    title,
    // De titel van een pandvideo bevat de gemeente vaak al ("Zonnestraat 12,
    // Gent"); die er dan nog eens achter zetten leest als een fout.
    title.includes(city) ? "" : city,
    platform?.fileSlug ?? slugify(preset.platform),
    `${preset.width}x${preset.height}`,
    input.date ? formatDatePart(input.date) : "",
  ].filter(Boolean);

  return `${parts.join("-")}.${preset.container}`;
}

/**
 * De namen voor een hele batch, met de garantie dat er geen twee gelijk zijn.
 *
 * Twee presets van hetzelfde platform in hetzelfde formaat kunnen op dezelfde
 * naam uitkomen. Dat is vandaag niet zo, maar het is precies het soort ding dat
 * bij het toevoegen van een preset stilletjes ontstaat — en dan overschrijft de
 * ene download de andere. Een oplopend cijfer houdt dat tegen.
 */
export function buildExportFileNames(
  presets: ExportPreset[],
  input: ExportFileNameInput,
): Map<ID, string> {
  const used = new Set<string>();
  const names = new Map<ID, string>();

  for (const preset of presets) {
    const name = buildExportFileName(preset, input);
    let unique = name;
    let counter = 2;

    while (used.has(unique)) {
      unique = name.replace(/\.([^.]+)$/, `-${counter}.$1`);
      counter += 1;
    }

    used.add(unique);
    names.set(preset.id, unique);
  }

  return names;
}
