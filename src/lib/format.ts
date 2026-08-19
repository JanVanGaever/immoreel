import { DEFAULT_CURRENCY, DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "@/lib/constants";

/** Presentatie-helpers. Bewust zonder domeinkennis of business rules. */

export function formatDate(value: Date | string | number): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | number): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(value));
}

export function formatCurrency(amountInCents: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
  }).format(amountInCents / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE).format(value);
}

/** Seconden -> "1:24" of "1:02:04". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/** Seconden met hoogstens één decimaal: "4 s", "2,5 s". Voor scènelengtes. */
export function formatSeconds(seconds: number): string {
  const value = new Intl.NumberFormat(DEFAULT_LOCALE, { maximumFractionDigits: 1 }).format(seconds);

  return `${value} s`;
}

export function formatBytes(bytes: number): string {
  const units = ["B", "kB", "MB", "GB", "TB"] as const;
  if (bytes <= 0) return "0 B";

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${new Intl.NumberFormat(DEFAULT_LOCALE, { maximumFractionDigits: 1 }).format(value)} ${units[exponent]}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** "3 uur geleden", "gisteren", "over 5 dagen". */
export function formatRelativeTime(value: Date | string | number, from: Date = new Date()): string {
  const diffInSeconds = Math.round((new Date(value).getTime() - from.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diffInSeconds) >= seconds) {
      return formatter.format(Math.round(diffInSeconds / seconds), unit);
    }
  }

  return formatter.format(diffInSeconds, "second");
}
