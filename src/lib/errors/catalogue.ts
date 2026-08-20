import type { AppErrorCode, ErrorDomain, ErrorSeverity, RetryPolicy } from "@/types/error";

/**
 * De catalogus: per foutcode één rij, en niets wat elders nog eens staat.
 *
 * Vier dingen liggen hier vast, en precies hier:
 *
 * 1. **Het domein** — waar de fout vandaan komt.
 * 2. **De zwaarte** — of dit een fout van de gebruiker is of van ons.
 * 3. **De zin** — wat er op het scherm komt, in het Nederlands.
 * 4. **Het retrybeleid** — of nog eens proberen zin heeft, en hoe vaak.
 *
 * Dat laatste is de reden dat deze tabel bestaat. Vóór deze laag stond
 * "helpt opnieuw proberen?" op drie plekken: in de worker (`RETRYABLE`), in de
 * uploadhook (impliciet — elke fout mocht opnieuw) en in de betaalpolling (een
 * lus die altijd doorging tot de klok afliep). Drie tabellen die hetzelfde
 * beweren, lopen vroeg of laat uit elkaar. Nu is er één.
 *
 * De HTTP-status staat er ook in, want een route moet er een kiezen en die
 * keuze hoort bij de fout — niet bij de route die hem toevallig als eerste
 * tegenkomt.
 */

/* -------------------------------------------------------------------------
 * De vier beleidsvormen
 * ---------------------------------------------------------------------- */

/** Dezelfde poging geeft dezelfde fout. */
const NONE: RetryPolicy = { mode: "none", maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0 };

/** Het kán lukken, maar de app beslist dat niet voor de gebruiker. */
const MANUAL: RetryPolicy = { mode: "manual", maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0 };

/** Een hapering: kort wachten en het is voorbij. */
const QUICK: RetryPolicy = { mode: "auto", maxAttempts: 3, initialDelayMs: 400, maxDelayMs: 4_000 };

/** Iets erachter ligt eruit. Langer volhouden, met grotere tussenpozen. */
const PATIENT: RetryPolicy = {
  mode: "auto",
  maxAttempts: 5,
  initialDelayMs: 1_000,
  maxDelayMs: 15_000,
};

export const RETRY_POLICIES = { NONE, MANUAL, QUICK, PATIENT } as const;

/* -------------------------------------------------------------------------
 * De catalogus
 * ---------------------------------------------------------------------- */

export type ErrorEntry = {
  domain: ErrorDomain;
  severity: ErrorSeverity;
  /** Wat de gebruiker leest. Geen techniek, geen verwijten. */
  message: string;
  /**
   * Wat hij vervolgens kan doen. Blijft leeg als het antwoord "wachten" is —
   * een zin die niets voorstelt, maakt een foutmelding alleen langer.
   */
  hint?: string;
  retry: RetryPolicy;
  /** De status die een route hierbij hoort te geven. */
  status: number;
};

const CATALOGUE: Record<AppErrorCode, ErrorEntry> = {
  /* ---- auth ---------------------------------------------------------- */
  unauthenticated: {
    domain: "auth",
    severity: "warning",
    message: "Je bent niet (meer) ingelogd.",
    hint: "Log opnieuw in; je werk blijft bewaard.",
    retry: NONE,
    status: 401,
  },
  forbidden: {
    domain: "auth",
    severity: "warning",
    message: "Je hebt hier geen toegang toe.",
    hint: "Vraag een beheerder van je kantoor om meer rechten.",
    retry: NONE,
    status: 403,
  },

  /* ---- invoer -------------------------------------------------------- */
  "invalid-input": {
    domain: "input",
    severity: "warning",
    message: "Er ontbreekt nog iets. Kijk de gemarkeerde velden na.",
    retry: NONE,
    status: 400,
  },
  "unsupported-media": {
    domain: "input",
    severity: "warning",
    message: "Dit bestandstype kunnen we niet gebruiken.",
    hint: "Gebruik een JPEG, PNG of WebP.",
    retry: NONE,
    status: 415,
  },
  "too-large": {
    domain: "input",
    severity: "warning",
    message: "Dit bestand is te groot.",
    hint: "Verklein de foto of kies een kleinere versie.",
    retry: NONE,
    status: 413,
  },

  /* ---- netwerk ------------------------------------------------------- */
  offline: {
    domain: "network",
    severity: "error",
    message: "Je lijkt geen internetverbinding te hebben.",
    hint: "Controleer je verbinding; we proberen het daarna vanzelf opnieuw.",
    retry: PATIENT,
    status: 503,
  },
  network: {
    domain: "network",
    severity: "error",
    message: "We konden de server niet bereiken.",
    retry: QUICK,
    status: 503,
  },
  timeout: {
    domain: "network",
    severity: "error",
    message: "Dit duurde te lang en is afgebroken.",
    retry: QUICK,
    status: 504,
  },
  aborted: {
    domain: "network",
    severity: "warning",
    message: "Dit is gestopt.",
    retry: NONE,
    status: 499,
  },
  "rate-limited": {
    domain: "network",
    severity: "warning",
    message: "Te veel aanvragen na elkaar.",
    hint: "Wacht even en probeer het opnieuw.",
    retry: PATIENT,
    status: 429,
  },

  /* ---- render -------------------------------------------------------- *
   * De zinnen hier zijn de algemene versie. Binnen één render staat er een
   * preciezere klaar (`src/lib/render/errors.ts`); die tabel legt uit waarom
   * dat de moeite waard is. Het retrybeleid komt wél alleen hiervandaan.     */
  "project-missing": {
    domain: "render",
    severity: "error",
    message: "Dit project bestaat niet meer.",
    retry: NONE,
    status: 404,
  },
  "preset-missing": {
    domain: "render",
    severity: "error",
    message: "Het gekozen exportformaat bestaat niet meer.",
    hint: "Kies een ander formaat in de editor.",
    retry: NONE,
    status: 404,
  },
  "assets-missing": {
    domain: "render",
    severity: "error",
    message: "Niet alle foto's staan in de opslag.",
    hint: "Upload de ontbrekende foto's opnieuw in de editor.",
    retry: NONE,
    status: 409,
  },
  "asset-download": {
    domain: "render",
    severity: "error",
    message: "Een foto kon niet opgehaald worden uit de opslag.",
    retry: PATIENT,
    status: 503,
  },
  ffmpeg: {
    domain: "render",
    severity: "error",
    message: "De video kon niet opgebouwd worden.",
    hint: "Pas iets aan in de montage en probeer het daarna opnieuw.",
    retry: NONE,
    status: 500,
  },
  storage: {
    domain: "render",
    severity: "error",
    message: "De opslag antwoordde niet.",
    retry: PATIENT,
    status: 503,
  },
  cancelled: {
    domain: "render",
    severity: "warning",
    // Geen retrybeleid: iemand heeft dit uitdrukkelijk gestopt. Een nieuwe
    // opdracht is iets anders dan een nieuwe poging, en die geeft de gebruiker
    // zelf ("Opnieuw insturen" op de exportkaart).
    message: "Dit is geannuleerd.",
    retry: NONE,
    status: 499,
  },

  /* ---- upload -------------------------------------------------------- */
  "upload-failed": {
    domain: "upload",
    severity: "error",
    message: "De upload is mislukt.",
    hint: "Probeer deze foto opnieuw te uploaden.",
    retry: MANUAL,
    status: 502,
  },
  "upload-rejected": {
    domain: "upload",
    severity: "warning",
    message: "Dit bestand is overgeslagen.",
    retry: NONE,
    status: 400,
  },

  /* ---- facturatie ---------------------------------------------------- */
  "payment-failed": {
    domain: "billing",
    severity: "error",
    message: "De betaling is niet doorgegaan.",
    hint: "Er is niets aangerekend. Probeer het opnieuw of kies een andere betaalmethode.",
    retry: MANUAL,
    status: 402,
  },
  "payment-not-found": {
    domain: "billing",
    severity: "error",
    message: "We vinden deze betaling niet terug.",
    hint: "Kijk op de facturatiepagina of ze doorgegaan is.",
    retry: NONE,
    status: 404,
  },
  "mandate-missing": {
    domain: "billing",
    severity: "warning",
    message: "Er staat geen geldige betaalmethode klaar.",
    hint: "Kies een betaalmethode om verder te gaan.",
    retry: NONE,
    status: 409,
  },
  "plan-unavailable": {
    domain: "billing",
    severity: "warning",
    message: "Dit abonnement is niet beschikbaar.",
    retry: NONE,
    status: 409,
  },

  /* ---- systeem ------------------------------------------------------- */
  "not-found": {
    domain: "system",
    severity: "warning",
    message: "We vinden dit niet terug.",
    retry: NONE,
    status: 404,
  },
  conflict: {
    domain: "system",
    severity: "warning",
    message: "Dit kan nu niet: er is intussen iets veranderd.",
    hint: "Ververs de pagina en probeer het opnieuw.",
    retry: MANUAL,
    status: 409,
  },
  unavailable: {
    domain: "system",
    severity: "error",
    message: "Deze dienst is even niet bereikbaar.",
    hint: "Probeer het over enkele minuten opnieuw.",
    retry: PATIENT,
    status: 503,
  },
  "server-error": {
    domain: "system",
    severity: "error",
    message: "Er ging iets mis aan onze kant.",
    hint: "Probeer het opnieuw. Blijft het misgaan, geef dan de foutcode door aan support.",
    retry: MANUAL,
    status: 500,
  },
  unknown: {
    domain: "system",
    severity: "error",
    message: "Er ging iets mis.",
    retry: MANUAL,
    status: 500,
  },
};

export function entryFor(code: AppErrorCode): ErrorEntry {
  return CATALOGUE[code] ?? CATALOGUE.unknown;
}

/** Alle codes, in de volgorde van de catalogus. Voor filters en overzichten. */
export const APP_ERROR_CODES = Object.keys(CATALOGUE) as AppErrorCode[];

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === "string" && value in CATALOGUE;
}

/** De status die bij deze fout hoort. Eén tabel, geen route die zelf kiest. */
export function statusFor(code: AppErrorCode): number {
  return entryFor(code).status;
}

/** De zin voor het scherm. */
export function messageForCode(code: AppErrorCode): string {
  return entryFor(code).message;
}

export function retryPolicyFor(code: AppErrorCode): RetryPolicy {
  return entryFor(code).retry;
}

export function domainFor(code: AppErrorCode): ErrorDomain {
  return entryFor(code).domain;
}

export function severityFor(code: AppErrorCode): ErrorSeverity {
  return entryFor(code).severity;
}

/**
 * Welke code hoort bij deze HTTP-status?
 *
 * Alleen nodig als er geen foutenvelop meekwam — een proxy die een 502
 * teruggeeft, een gateway die een 504 verzint, een opslag die niet van ons is.
 * Onze eigen routes sturen de code altijd mee, en dan komt deze functie er niet
 * aan te pas.
 */
export function codeForStatus(status: number): AppErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 402) return "payment-failed";
  if (status === 409) return "conflict";
  if (status === 413) return "too-large";
  if (status === 415) return "unsupported-media";
  if (status === 429) return "rate-limited";
  if (status === 408 || status === 504) return "timeout";
  if (status === 502 || status === 503) return "unavailable";
  if (status >= 500) return "server-error";
  if (status >= 400) return "invalid-input";

  return "unknown";
}
