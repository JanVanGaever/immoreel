"use client";

import { useId } from "react";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { normaliseHex } from "@/lib/brand/colors";
import { cn } from "@/lib/utils";

/**
 * Eén huisstijlkleur: een staal om te kiezen en een hexcode om te plakken.
 *
 * Allebei, en niet één van de twee. Een makelaar die zijn merkkleur kent, typt
 * `#0f5f57` en is klaar; wie ze niet kent, klikt en schuift. De twee zijn
 * altijd dezelfde waarde — het staal toont wat er getypt is zodra dat een
 * kleur is, en laat de vorige staan zolang iemand nog aan het typen is.
 */

export type ColorFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  className?: string;
};

export function ColorField({
  label,
  hint,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  className,
}: ColorFieldProps) {
  const swatchId = useId();
  // `<input type="color">` accepteert alleen `#rrggbb`. Half getypte invoer
  // laat het staal dus staan op wat het al toonde.
  const swatch = normaliseHex(value) ?? "#000000";

  return (
    <FormField label={label} hint={hint} error={error} disabled={disabled} className={className}>
      <div className="flex items-center gap-2">
        <input
          id={swatchId}
          type="color"
          value={swatch}
          disabled={disabled}
          aria-label={`${label} kiezen`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className={cn(
            "size-9 shrink-0 cursor-pointer rounded-md border border-border bg-surface p-1",
            "disabled:cursor-not-allowed disabled:opacity-55",
          )}
        />
        <Input
          value={value}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          placeholder="#0f5f57"
          className="font-mono"
          onChange={(event) => onChange(event.target.value)}
          // Pas bij het verlaten van het veld rechttrekken: tijdens het typen
          // is `#0f5` nog onderweg naar `#0f5f57`.
          onBlur={() => {
            const normalised = normaliseHex(value);
            if (normalised && normalised !== value) onChange(normalised);
            onBlur?.();
          }}
        />
      </div>
    </FormField>
  );
}
