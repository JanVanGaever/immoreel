/**
 * De vorm van een fout, overal dezelfde.
 *
 * Deze app maakt fouten op vier plekken die niets van elkaar weten: een
 * serveractie achter een formulier, een upload in de browser, een worker die
 * rendert, en een betaling die van Mollie terugkomt. Zonder afspraak krijgt
 * elk van die vier zijn eigen bedenksel — een string hier, een `{ status:
 * "fout", message }` daar — en dan is "toon een fout" vier keer werk en vier
 * keer een andere ervaring.
 *
 * Vandaar één vorm. De regels erachter:
 *
 * - De **code** is Engels en machinetaal. Daar programmeer je op, daar filter
 *   je logs op, en die verandert niet omdat een zin beter kon.
 * - Het **bericht** is Nederlands en mag letterlijk op het scherm. Nooit een
 *   stacktrace, nooit een pad, nooit een sleutel.
 * - De **detail** is voor de logs. Die gaat standaard niet mee naar de browser.
 * - De **retry** hoort bij de fout en niet bij het scherm: of iets zin heeft om
 *   nog eens te proberen, weet de fout — niet de knop.
 *
 * Alles hier is puur data: geen klassen, geen functies. Zo reist een fout
 * ongewijzigd van een worker via Redis naar een serveractie naar een prop van
 * een component, zonder onderweg van vorm te veranderen.
 */

/**
 * Waar de fout vandaan komt. Bepaalt de toon van het scherm en het filter in
 * de logs, niet de afhandeling — die hangt aan de code.
 */
export type ErrorDomain =
  /** Niet ingelogd, geen rechten, sessie verlopen. */
  | "auth"
  /** Wat de gebruiker instuurde, klopt niet. */
  | "input"
  /** Onderweg blijven steken: geen verbinding, te traag, afgebroken. */
  | "network"
  /** De renderpijplijn en alles wat eraan hangt. */
  | "render"
  /** Bestanden onderweg naar de opslag. */
  | "upload"
  /** Betalingen, abonnementen en mandaten. */
  | "billing"
  /** De rest: van ons, niet van de gebruiker. */
  | "system";

/**
 * Hoe zwaar dit weegt in het scherm.
 *
 * `warning` is een fout die de gebruiker zelf oplost (een veld invullen, een
 * kleiner bestand kiezen), `error` een fout waar hij niets aan kan doen. Het
 * verschil is de kleur van het blok en de vraag of er een knop bij hoort.
 */
export type ErrorSeverity = "warning" | "error";

/**
 * De foutcodes van de hele app, gegroepeerd per herkomst.
 *
 * Eén union en geen union per laag, want dan zou elke grens een vertaling
 * nodig hebben — en juist op die grenzen gaat het mis. De rendercodes staan
 * letterlijk in de databank (`RenderJobError.code`) en in de admin-filters,
 * dus die namen liggen vast.
 */
export type AppErrorCode =
  // auth
  | "unauthenticated"
  | "forbidden"
  // input
  | "invalid-input"
  | "unsupported-media"
  | "too-large"
  // netwerk
  | "offline"
  | "network"
  | "timeout"
  | "aborted"
  | "rate-limited"
  // render (deze namen staan in de databank; zie `RenderErrorCode`)
  | "project-missing"
  | "preset-missing"
  | "assets-missing"
  | "asset-download"
  | "ffmpeg"
  | "storage"
  | "cancelled"
  // upload
  | "upload-failed"
  | "upload-rejected"
  // facturatie
  | "payment-failed"
  | "payment-not-found"
  | "mandate-missing"
  | "plan-unavailable"
  | "subscription-required"
  // systeem
  | "not-found"
  | "conflict"
  | "unavailable"
  | "server-error"
  | "unknown";

/**
 * Wat er met een nieuwe poging te winnen valt.
 *
 * - `none`   — dezelfde poging geeft dezelfde fout. Geen knop.
 * - `manual` — het kán lukken, maar niet vanzelf: de gebruiker beslist.
 * - `auto`   — de oorzaak ligt buiten de opdracht (netwerk, opslag, wachtrij).
 *              Hier mag de app het zelf nog eens proberen.
 */
export type RetryMode = "none" | "manual" | "auto";

export type RetryPolicy = {
  mode: RetryMode;
  /** Inclusief de eerste poging. Bij `none` en `manual` altijd 1. */
  maxAttempts: number;
  /** Wachttijd voor de tweede poging; daarna verdubbelt ze. */
  initialDelayMs: number;
  /** Bovengrens op die verdubbeling. */
  maxDelayMs: number;
};

/** Foutmeldingen per veld: `{ email: "Vul een geldig e-mailadres in." }`. */
export type FieldErrors = Record<string, string>;

/**
 * Een fout als data.
 *
 * Dit is wat over de lijn gaat en wat een component binnenkrijgt. `detail`
 * staat er als optioneel veld in en niet als verplicht: op de server hoort hij
 * erbij, richting de browser laat je hem weg (zie `AppError.toShape`).
 */
export type AppErrorShape = {
  code: AppErrorCode;
  domain: ErrorDomain;
  severity: ErrorSeverity;
  /** Nederlands, voor het scherm. */
  message: string;
  /** Eén zin die zegt wat de gebruiker nu kan doen; `null` als er niets te doen is. */
  hint: string | null;
  fields: FieldErrors | null;
  retry: RetryPolicy;
  /**
   * Korte verwijzing, uniek per fout. Staat in het scherm én in de logregel,
   * zodat een melding van een klant in één zoekopdracht terug te vinden is.
   */
  errorId: string;
  at: string;
  /** De technische keten van oorzaken. Voor de logs, niet voor het scherm. */
  detail?: string | null;
};
