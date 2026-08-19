"use client";

import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { controlBase, controlSizes, type ControlSize } from "@/components/ui/control";
import { useFieldProps } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type SelectProps = Omit<ComponentProps<"select">, "size"> & {
  selectSize?: ControlSize;
  /** Tekst voor de lege keuze; laat weg als er altijd een waarde is. */
  placeholder?: string;
};

/**
 * Bewust de native `<select>`: volledige toetsenbord- en mobiele
 * ondersteuning zonder extra JavaScript.
 */
export function Select({
  selectSize = "md",
  placeholder,
  className,
  children,
  ...rest
}: SelectProps) {
  const props = useFieldProps(rest);

  return (
    <div className="relative">
      <select
        className={cn(controlBase, controlSizes[selectSize], "appearance-none pr-9", className)}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-subtle"
      />
    </div>
  );
}
