import { DEFAULT_CURRENCY } from "@/lib/constants";
import type { MollieAmount } from "@/lib/mollie/types";

/**
 * Centen naar Mollie en terug.
 *
 * Mollie rekent in strings met exact twee decimalen (`"49.00"`), wij in hele
 * centen. Die vertaling op één plek houden is geen netheid maar noodzaak: een
 * `toFixed(2)` op een gedeeld getal is precies waar een cent verdwijnt, en één
 * verdwenen cent is een incasso die niet klopt met de factuur.
 */

export function toMollieAmount(cents: number, currency = DEFAULT_CURRENCY): MollieAmount {
  const rounded = Math.round(cents);

  return {
    currency,
    // Op de string werken in plaats van op een float: `12345 / 100` is
    // 123.45000000000001 zodra je er ooit mee rekent.
    value: `${Math.trunc(rounded / 100)}.${String(Math.abs(rounded) % 100).padStart(2, "0")}`,
  };
}

export function fromMollieAmount(amount: MollieAmount): number {
  const [whole = "0", fraction = "0"] = amount.value.split(".");
  const sign = whole.trim().startsWith("-") ? -1 : 1;

  return (
    sign *
    (Math.abs(Number.parseInt(whole, 10)) * 100 + Number.parseInt(fraction.padEnd(2, "0"), 10))
  );
}
