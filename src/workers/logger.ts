import { describe } from "@/lib/render/errors";

/**
 * Logs van een worker leest niemand live. Ze worden gelezen wanneer er iets
 * misging, uren later, in een zoekvenster van een logdienst. Daarom één regel
 * JSON per gebeurtenis met altijd dezelfde velden: op jobId filteren moet een
 * zoekopdracht zijn, geen leesoefening.
 */

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type Logger = {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  /** De fout hoort erbij, inclusief haar oorzaken; zie `describe`. */
  error(message: string, error?: unknown, fields?: LogFields): void;
  /** Zelfde logger met vaste velden erbij, bijvoorbeeld per job. */
  child(fields: LogFields): Logger;
};

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const configured = process.env.LOG_LEVEL as Level | undefined;

  return LEVELS[configured ?? "info"] ?? LEVELS.info;
}

export function createLogger(scope: string, base: LogFields = {}): Logger {
  function write(level: Level, message: string, fields: LogFields): void {
    if (LEVELS[level] < threshold()) return;

    const line = JSON.stringify({
      at: new Date().toISOString(),
      level,
      scope,
      message,
      ...base,
      ...fields,
    });

    // Fouten naar stderr, de rest naar stdout: zo blijft de scheiding
    // overeind in elke procesmanager en logdienst.
    if (level === "error") process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  }

  return {
    debug: (message, fields = {}) => write("debug", message, fields),
    info: (message, fields = {}) => write("info", message, fields),
    warn: (message, fields = {}) => write("warn", message, fields),
    error: (message, error, fields = {}) =>
      write("error", message, {
        ...fields,
        ...(error === undefined ? {} : { error: describe(error) }),
      }),
    child: (fields) => createLogger(scope, { ...base, ...fields }),
  };
}
