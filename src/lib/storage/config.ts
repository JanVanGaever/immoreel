/**
 * Alles wat de object storage uit de omgeving haalt, op één plek — zoals
 * `src/lib/mollie/config.ts` dat voor de betalingen doet en
 * `src/workers/config.ts` voor de renderwachtrij.
 *
 * De koppeling praat S3, en dat is met opzet geen keuze voor Amazon: Cloudflare
 * R2, Scaleway, MinIO en Backblaze spreken hetzelfde protocol. Wat er per
 * aanbieder verschilt, is het adres en de vorm van de URL, en allebei staan ze
 * hieronder.
 *
 * Alleen op de server. De geheime sleutel geeft toegang tot alle foto's en
 * video's van alle kantoren; die hoort nooit in een bundel voor de browser.
 */

export type StorageConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Het adres van de dienst, zonder bucket. Leeg betekent Amazon zelf, en dan
   * wordt het adres uit de regio afgeleid.
   */
  endpoint: string | null;
  /**
   * `true` zet de bucket in het pad (`https://host/bucket/sleutel`), `false` in
   * de hostnaam (`https://bucket.host/sleutel`). Amazon wil het tweede, de
   * meeste andere aanbieders het eerste — daarom volgt de standaard de vraag of
   * er een eigen endpoint staat.
   */
  forcePathStyle: boolean;
};

/**
 * Staat de opslag ingesteld?
 *
 * `STORAGE_BUCKET` is de schakelaar, net als `REDIS_URL` dat voor de wachtrij
 * is: staat hij leeg, dan blijft alles op de schijf staan en werkt de app
 * gewoon — alleen niet over meerdere instanties heen.
 */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.STORAGE_BUCKET);
}

/**
 * De configuratie, of een fout die zegt wat er ontbreekt.
 *
 * Bewust alles-of-niets: een half ingevulde opslag is erger dan geen, want dan
 * lopen de uploads van vandaag naar een andere plek dan die van gisteren. Wie
 * `STORAGE_BUCKET` zet, zegt daarmee dat de rest er ook is.
 */
export function getStorageConfig(): StorageConfig {
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

  const missing = [
    !bucket && "STORAGE_BUCKET",
    !accessKeyId && "STORAGE_ACCESS_KEY_ID",
    !secretAccessKey && "STORAGE_SECRET_ACCESS_KEY",
  ].filter(Boolean);

  if (missing.length > 0 || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(`Object storage is half ingesteld: ${missing.join(", ")} ontbreekt.`);
  }

  const endpoint = process.env.STORAGE_ENDPOINT?.replace(/\/+$/, "") || null;
  const pathStyle = process.env.STORAGE_FORCE_PATH_STYLE;

  return {
    bucket,
    accessKeyId,
    secretAccessKey,
    // Aanbieders zonder regio's (MinIO, R2) verwachten hier `auto` of
    // `us-east-1`; de handtekening rekent er hoe dan ook mee, dus hij moet
    // kloppen met wat de aanbieder verwacht en niet met waar de server staat.
    region: process.env.STORAGE_REGION || "auto",
    endpoint,
    forcePathStyle: pathStyle ? pathStyle !== "0" && pathStyle !== "false" : Boolean(endpoint),
  };
}

/**
 * Het volledige adres van één object, en het pad zoals de handtekening het
 * moet zien.
 *
 * Die twee staan hier samen omdat ze niet uit elkaar mogen lopen: tekent de
 * ene `/bucket/sleutel` terwijl de andere `/sleutel` ophaalt, dan klopt de
 * handtekening niet en is de fout van S3 ("SignatureDoesNotMatch") precies
 * nietszeggend genoeg om een avond aan kwijt te zijn.
 */
export function objectUrl(config: StorageConfig, key: string): { url: URL; canonicalPath: string } {
  const encodedKey = encodeStorageKey(key);

  const base = config.endpoint ?? `https://s3.${config.region}.amazonaws.com`;
  const { protocol, host } = new URL(base);

  if (config.forcePathStyle) {
    const path = `/${config.bucket}/${encodedKey}`;

    return { url: new URL(`${protocol}//${host}${path}`), canonicalPath: path };
  }

  const path = `/${encodedKey}`;

  return { url: new URL(`${protocol}//${config.bucket}.${host}${path}`), canonicalPath: path };
}

/**
 * Een sleutel voor in een URL. De schuine streep blijft staan — die scheidt
 * mappen in de sleutel — en al de rest gaat door de codering van RFC 3986.
 */
export function encodeStorageKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

/**
 * `encodeURIComponent` laat zeven tekens ongemoeid die RFC 3986 wél codeert.
 * S3 rekent met de strengere variant, dus een bestandsnaam met een apostrof
 * erin zou anders een andere handtekening opleveren dan de server berekent.
 */
export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
