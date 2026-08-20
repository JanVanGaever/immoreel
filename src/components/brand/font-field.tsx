"use client";

import { FormField } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { BRAND_FONTS, findFont } from "@/lib/brand/fonts";
import type { BrandFontId } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Het lettertype van de huisstijl, met een regel eronder in dat lettertype
 * zelf. Een naam in een keuzelijst zegt niets; "Vastgoedkantoor Janssens"
 * getekend in Libre Baskerville zegt alles.
 */

export type FontFieldProps = {
  value: BrandFontId;
  onChange: (fontId: BrandFontId) => void;
  /** De tekst in het voorbeeld; standaard de naam van het kantoor. */
  sample?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
};

export function FontField({
  value,
  onChange,
  sample,
  error,
  disabled = false,
  className,
}: FontFieldProps) {
  const font = findFont(value);
  const preview = sample?.trim() || "Vastgoedkantoor Janssens";

  return (
    <FormField
      label="Lettertype"
      hint={font.description}
      error={error}
      disabled={disabled}
      className={className}
    >
      <Select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as BrandFontId)}>
        {BRAND_FONTS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>

      <p
        aria-hidden="true"
        className={cn(
          "mt-1 truncate rounded-md border border-border bg-surface-subtle px-3 py-2 text-lg leading-snug text-fg",
          disabled && "opacity-55",
        )}
        style={{ fontFamily: font.stack }}
      >
        {preview}
      </p>
    </FormField>
  );
}
