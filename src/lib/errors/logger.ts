import { isAppError } from "@/lib/errors/app-error";
import { describeError } from "@/lib/errors/normalize";

/**
 * Logs voor developers.
 *
 * Logs leest niemand live. Ze worden gelezen wanneer er iets misging, uren
 * later, in een zoekvenster. Daarom één regel JSON per gebeurtenis met altijd
 * dezelfde velden: op `jobId` of `errorId` filteren moet een zoekopdracht zijn,
 * geen leesoefening.
 *
 * Deze logger draait op drie plekken, en past zich per plek aan:
 *
 * - **De worker** schrijft naar stdout en stderr. Dat is wat een procesmanager
 *   en een logdienst verwachten, en de scheiding tussen de twee blijft overeind.
 * - **De server** doet hetzelfde; in Next komt dat in de serverlogs terecht.
 * - **De browser** schrijft naar de console, maar dan leesbaar in plaats van
 *   als JSON — een developer die zijn eigen tabblad openheeft, zoekt niet, die
 *   kijkt. De drempel ligt er ook hoger: een gebruiker hoeft onze `debug`-
 *   regels niet in zijn console te hebben.
 *
 * Wat er nooit in een logregel komt, staat in `REDACTED`: een wachtwoord of een
 * token dat één keer in een log belandt, staat daar voorgoed.
 */

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type Logger = {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  /**
   * De fout hoort erbij, inclusief haar oorzaken. Bij een `AppError` komen de
   * code, het domein en de `errorId` er als eigen velden bij — dat zijn de
   * dingen waarop je filtert.
   */
  error(message: string, error?: unknown, fields?: LogFields): void;
  /** Zelfde logger met vaste velden erbij, bijvoorbeeld per job of per verzoek. */
  child(fields: LogFields): Logger;
};

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Veldnamen waarvan de waarde nooit in een log hoort. */
const REDACTED = /^(password|token|secret|apiKey|authorization|cookie|sessionToken)$/i;

const isServer = typeof window === "undefined";

function threshold(): number {
  const configured = (isServer ? process.env.LOG_LEVEL : process.env.NEXT_PUBLIC_LOG_LEVEL) as
    | Level
    | undefined;

  if (configured && configured in LEVELS) return LEVELS[configured];

  // In de browser is `info` ruis voor wie geen developer is.
  return isServer ? LEVELS.info : LEVELS.warn;
}

function clean(fields: LogFields): LogFields {
  const result: LogFields = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    result[key] = REDACTED.test(key) ? "[verborgen]" : value;
  }

  return result;
}

/**
 * De velden die een fout meebrengt.
 *
 * Bij een `AppError` is dat meer dan de tekst: de code om op te filteren, het
 * domein om op te groeperen, de `errorId` die de gebruiker in zijn scherm zag,
 * en de context die de laag eronder eraan hing.
 */
function fieldsOfError(error: unknown): LogFields {
  if (error === undefined) return {};

  if (isAppError(error)) {
    return {
      ...error.context,
      errorCode: error.code,
      errorDomain: error.domain,
      errorId: error.errorId,
      retry: error.retry.mode,
      error: error.detail ?? describeError(error),
    };
  }

  return { error: describeError(error) };
}

export function createLogger(scope: string, base: LogFields = {}): Logger {
  function write(level: Level, message: string, fields: LogFields): void {
    if (LEVELS[level] < threshold()) return;

    const payload = clean({ ...base, ...fields });

    if (!isServer) {
      const sink =
        level === "error" ? console.error : level === "warn" ? console.warn : console.info;

      sink(`[${scope}] ${message}`, payload);
      return;
    }

    const line = `${JSON.stringify({
      at: new Date().toISOString(),
      level,
      scope,
      message,
      ...payload,
    })}\n`;

    // Fouten naar stderr, de rest naar stdout: zo blijft de scheiding overeind
    // in elke procesmanager en logdienst.
    if (level === "error") process.stderr.write(line);
    else process.stdout.write(line);
  }

  return {
    debug: (message, fields = {}) => write("debug", message, fields),
    info: (message, fields = {}) => write("info", message, fields),
    warn: (message, fields = {}) => write("warn", message, fields),
    error: (message, error, fields = {}) =>
      write("error", message, { ...fields, ...fieldsOfError(error) }),
    child: (fields) => createLogger(scope, { ...base, ...fields }),
  };
}

/**
 * De logger voor wie er geen eigen aanmaakt. Handig in een component of een
 * losse functie; een module met veel logregels maakt beter een eigen scope aan.
 */
export const logger = createLogger("app");
