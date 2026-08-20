"use client";

import { PAYMENT_METHODS } from "@/lib/billing/methods";
import { cn } from "@/lib/utils";
import type { PaymentMethodId } from "@/types";

/**
 * De keuze tussen Bancontact en kaart.
 *
 * Bancontact staat vooraan en is voorgeselecteerd. Dat is geen voorkeur maar
 * een feit over de Belgische markt: het is verreweg de gewoonste manier om
 * online te betalen, en een scherm dat begint met "kredietkaart" voelt hier
 * meteen als een buitenlandse webshop.
 *
 * Onder elke keuze staat wat er ná deze betaling gebeurt. Dat hoort hier en
 * niet in de kleine lettertjes: wat de klant tekent is niet één betaling maar
 * een machtiging, en dat mag hij weten voor hij klikt.
 */

export type PaymentMethodPickerProps = {
  value: PaymentMethodId;
  onChange: (method: PaymentMethodId) => void;
  disabled?: boolean;
  className?: string;
};

export function PaymentMethodPicker({
  value,
  onChange,
  disabled = false,
  className,
}: PaymentMethodPickerProps) {
  return (
    <fieldset className={cn("space-y-2", className)} disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-fg">Hoe wil je betalen?</legend>

      {PAYMENT_METHODS.map((method) => {
        const isSelected = method.id === value;

        return (
          <label
            key={method.id}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border px-4 py-3.5",
              "transition-[border-color,background-color] duration-150",
              isSelected
                ? "border-brand bg-brand-soft/40 ring-1 ring-brand/30"
                : "border-border bg-surface hover:border-border-strong",
              disabled && "cursor-not-allowed opacity-55",
            )}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={method.id}
              checked={isSelected}
              onChange={() => onChange(method.id)}
              className="mt-1 size-4 shrink-0 accent-[var(--color-brand)]"
            />

            <span className="min-w-0">
              <span className="block text-sm font-medium text-fg">{method.label}</span>
              <span className="mt-0.5 block text-xs text-fg-muted">{method.description}</span>
              {isSelected ? (
                <span className="mt-2 block text-xs leading-snug text-fg-subtle">
                  {method.recurringNote}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
