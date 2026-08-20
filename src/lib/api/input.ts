import { invalidInput, unsupportedMedia, type FieldErrors } from "@/lib/api/errors";

/**
 * Wat er binnenkomt, uitpakken.
 *
 * Deze module doet bewust maar de helft van het werk: ze controleert de *vorm*
 * van wat er binnenkomt — is dit tekst, is dit een getal, staat dit veld er
 * wel — en niets over de betekenis. Of een titel lang genoeg is, of een
 * template bij de beeldverhouding past, of een kleur een kleur is: dat staat al
 * in `lib/new-project/validation.ts`, `lib/editor/validation.ts` en
 * `lib/brand/validation.ts`, en die functies draaien ook in de browser. Ze hier
 * nog eens overschrijven zou betekenen dat een regel op twee plekken staat, en
 * dan is er altijd één die achterloopt.
 *
 * De lezer verzamelt fouten in plaats van bij de eerste te stoppen. Wie een
 * formulier verstuurt met drie fouten erin, hoort er drie terug te krijgen —
 * dezelfde afspraak als bij de serveracties, waar `DraftErrors` en
 * `EditorErrors` ook per veld werken.
 *
 * ```ts
 * const reader = new InputReader(await readJsonObject(request));
 * const title = reader.requiredText("title", { max: 80 });
 * const ratio = reader.requiredChoice("aspectRatio", ASPECT_RATIOS);
 * reader.done(); // gooit een 400 met alle velden erin, of laat door
 * ```
 *
 * Na `done()` is elk veld dat gelezen werd ook echt van de vorm die het type
 * belooft. Vóór `done()` is dat niet zo: een mislukte lezing geeft een
 * plaatshouder terug en zet een fout klaar. Lees dus eerst alles, roep dan
 * `done()`, en gebruik de waarden pas daarna.
 */

/** Het lichaam van een verzoek als JSON-object. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw unsupportedMedia("Stuur dit verzoek als application/json.");
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    throw invalidInput("De inhoud van dit verzoek is geen geldige JSON.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidInput("Het verzoek hoort een JSON-object te zijn.");
  }

  return payload as Record<string, unknown>;
}

/**
 * De bestanden uit een multipart-verzoek.
 *
 * Elk bestand telt mee, ongeacht onder welke veldnaam het zit. Dat is met
 * opzet: de uploadtransport in de browser stuurt er `file` bij, een `curl -F`
 * gebruikt vaak `files[]`, en een derde client verzint weer iets anders. De
 * veldnaam zegt niets wat we niet uit de inhoud kunnen halen, dus is er geen
 * reden om er een verzoek op af te wijzen.
 *
 * Lege bestanden vallen af. Een browser stuurt bij een leeg `<input type=file>`
 * soms een `File` van nul bytes mee, en dat is geen upload.
 */
export async function readFormFiles(request: Request): Promise<File[]> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    throw unsupportedMedia("Stuur de bestanden als multipart/form-data.");
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    throw invalidInput("De inhoud van dit verzoek is geen geldig formulier.");
  }

  const files: File[] = [];

  for (const value of form.values()) {
    if (value instanceof File && value.size > 0) files.push(value);
  }

  return files;
}

export type TextOptions = {
  max?: number;
  /** Standaard `true`: spaties aan de randen zeggen niets. */
  trim?: boolean;
};

export type NumberOptions = {
  min?: number;
  max?: number;
  integer?: boolean;
};

export type ListOptions = {
  max?: number;
};

/** Gedeeld tussen een lezer en de lezers van zijn deelobjecten. */
type ReaderState = {
  errors: FieldErrors;
  /** `scenes[2].motion.` — zodat een fout diep in een document te plaatsen is. */
  prefix: string;
};

export class InputReader {
  readonly #source: Record<string, unknown>;
  readonly #state: ReaderState;

  constructor(source: Record<string, unknown>, state?: ReaderState) {
    this.#source = source;
    this.#state = state ?? { errors: {}, prefix: "" };
  }

  /** Staat dit veld in het verzoek? Het verschil tussen "laat staan" en "maak leeg". */
  has(name: string): boolean {
    return Object.hasOwn(this.#source, name) && this.#source[name] !== undefined;
  }

  /** De ruwe waarde, voor het enkele geval dat de vorm er niet toe doet. */
  raw(name: string): unknown {
    return this.#source[name];
  }

  /** Zelf een fout toevoegen, bijvoorbeeld na een controle tegen de store. */
  fail(name: string, message: string): void {
    this.#state.errors[`${this.#state.prefix}${name}`] = message;
  }

  /* ---------------------------------------------------------------------
   * Tekst
   * ------------------------------------------------------------------ */

  text(name: string, options: TextOptions = {}): string | undefined {
    if (!this.has(name)) return undefined;

    const value = this.#source[name];

    if (typeof value !== "string") {
      this.fail(name, "Dit veld hoort tekst te zijn.");
      return undefined;
    }

    const text = options.trim === false ? value : value.trim();

    if (options.max !== undefined && text.length > options.max) {
      this.fail(name, `Hou het onder ${options.max} tekens.`);
      return undefined;
    }

    return text;
  }

  /**
   * Verplichte tekst. Alleen spaties telt als niets ingevuld: dat is wat de
   * gebruiker ziet, en dus wat het hoort te betekenen.
   */
  requiredText(name: string, options: TextOptions = {}): string {
    if (!this.has(name)) {
      this.fail(name, "Dit veld is verplicht.");
      return "";
    }

    const value = this.text(name, options);
    if (value === undefined) return "";

    if (value === "") {
      this.fail(name, "Dit veld is verplicht.");
      return "";
    }

    return value;
  }

  /** Tekst die uitdrukkelijk leeggemaakt mag worden met `null`. */
  nullableText(name: string, options: TextOptions = {}): string | null | undefined {
    if (!this.has(name)) return undefined;
    if (this.#source[name] === null) return null;

    const value = this.text(name, options);

    // Een lege string en `null` betekenen hier hetzelfde: er staat niets meer.
    return value === "" ? null : value;
  }

  /* ---------------------------------------------------------------------
   * Getallen en ja/nee
   * ------------------------------------------------------------------ */

  number(name: string, options: NumberOptions = {}): number | undefined {
    if (!this.has(name)) return undefined;

    const value = this.#source[name];

    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.fail(name, "Dit veld hoort een getal te zijn.");
      return undefined;
    }

    if (options.integer && !Number.isInteger(value)) {
      this.fail(name, "Dit veld hoort een heel getal te zijn.");
      return undefined;
    }

    if (options.min !== undefined && value < options.min) {
      this.fail(name, `Dit mag niet kleiner zijn dan ${options.min}.`);
      return undefined;
    }

    if (options.max !== undefined && value > options.max) {
      this.fail(name, `Dit mag niet groter zijn dan ${options.max}.`);
      return undefined;
    }

    return value;
  }

  requiredNumber(name: string, options: NumberOptions = {}): number {
    if (!this.has(name)) {
      this.fail(name, "Dit veld is verplicht.");
      return 0;
    }

    return this.number(name, options) ?? 0;
  }

  boolean(name: string): boolean | undefined {
    if (!this.has(name)) return undefined;

    const value = this.#source[name];

    if (typeof value !== "boolean") {
      this.fail(name, "Dit veld hoort waar of niet waar te zijn.");
      return undefined;
    }

    return value;
  }

  nullableBoolean(name: string): boolean | null | undefined {
    if (!this.has(name)) return undefined;
    if (this.#source[name] === null) return null;

    return this.boolean(name);
  }

  /* ---------------------------------------------------------------------
   * Keuzes uit een lijst
   * ------------------------------------------------------------------ */

  choice<T extends string>(name: string, allowed: readonly T[]): T | undefined {
    const value = this.text(name);
    if (value === undefined) return undefined;

    if (!(allowed as readonly string[]).includes(value)) {
      this.fail(name, `Kies een van deze waarden: ${allowed.join(", ")}.`);
      return undefined;
    }

    return value as T;
  }

  requiredChoice<T extends string>(name: string, allowed: readonly T[]): T | undefined {
    if (!this.has(name)) {
      this.fail(name, "Dit veld is verplicht.");
      return undefined;
    }

    return this.choice(name, allowed);
  }

  nullableChoice<T extends string>(name: string, allowed: readonly T[]): T | null | undefined {
    if (!this.has(name)) return undefined;
    if (this.#source[name] === null) return null;

    return this.choice(name, allowed);
  }

  /* ---------------------------------------------------------------------
   * Lijsten en deelobjecten
   * ------------------------------------------------------------------ */

  textList(name: string, options: ListOptions = {}): string[] | undefined {
    const items = this.#list(name, options);
    if (!items) return undefined;

    const result: string[] = [];

    for (const [index, item] of items.entries()) {
      if (typeof item !== "string" || item.trim() === "") {
        this.fail(`${name}[${index}]`, "Dit hoort tekst te zijn.");
        continue;
      }

      result.push(item.trim());
    }

    return result;
  }

  /**
   * Een lijst objecten, elk gelezen met een eigen lezer. Fouten uit die lezers
   * komen in dezelfde verzameling terecht, met hun plek in de lijst ervoor:
   * `scenes[3].durationInSeconds`.
   */
  objectList<T>(
    name: string,
    read: (reader: InputReader, index: number) => T,
    options: ListOptions = {},
  ): T[] | undefined {
    const items = this.#list(name, options);
    if (!items) return undefined;

    const result: T[] = [];

    for (const [index, item] of items.entries()) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        this.fail(`${name}[${index}]`, "Dit hoort een object te zijn.");
        continue;
      }

      result.push(read(this.#child(item as Record<string, unknown>, `${name}[${index}]`), index));
    }

    return result;
  }

  /** Eén deelobject, bijvoorbeeld `branding` of `audio`. */
  object<T>(name: string, read: (reader: InputReader) => T): T | undefined {
    if (!this.has(name)) return undefined;

    const value = this.#source[name];

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      this.fail(name, "Dit hoort een object te zijn.");
      return undefined;
    }

    return read(this.#child(value as Record<string, unknown>, name));
  }

  /* ---------------------------------------------------------------------
   * Afsluiten
   * ------------------------------------------------------------------ */

  /** Alles gelezen? Dan hier de rekening: een 400 met alle velden erin. */
  done(): void {
    if (Object.keys(this.#state.errors).length === 0) return;

    throw invalidInput("Er ontbreekt nog iets. Kijk de gemarkeerde velden na.", this.#state.errors);
  }

  #child(source: Record<string, unknown>, name: string): InputReader {
    return new InputReader(source, {
      errors: this.#state.errors,
      prefix: `${this.#state.prefix}${name}.`,
    });
  }

  #list(name: string, options: ListOptions): unknown[] | undefined {
    if (!this.has(name)) return undefined;

    const value = this.#source[name];

    if (!Array.isArray(value)) {
      this.fail(name, "Dit veld hoort een lijst te zijn.");
      return undefined;
    }

    if (options.max !== undefined && value.length > options.max) {
      this.fail(name, `Maximaal ${options.max} stuks.`);
      return undefined;
    }

    return value;
  }
}
