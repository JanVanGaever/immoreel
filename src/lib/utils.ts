import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Voegt class names samen en lost conflicterende Tailwind-utilities op.
 * Gebruik dit in elk component dat een `className`-prop doorgeeft.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** `?token=a&token=b` levert een array op; hier is altijd de eerste waarde bedoeld. */
export function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
