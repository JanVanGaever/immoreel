"use client";

import type { ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type OptionCardProps = {
  /** Radiogroep waar deze kaart bij hoort. */
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Klein label rechtsboven, bijvoorbeeld "Voorstel". */
  badge?: ReactNode;
  /** Visueel voorbeeld boven de tekst, zoals een kader in de juiste verhouding. */
  media?: ReactNode;
  className?: string;
};

/**
 * Eén keuze in de wizard: een kaart die zich als radiobutton gedraagt. De
 * echte `<input>` blijft bestaan (maar onzichtbaar), zodat pijltjestoetsen,
 * schermlezers en formulieren gewoon werken.
 */
export function OptionCard({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  icon: Icon,
  badge,
  media,
  className,
}: OptionCardProps) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col gap-3 rounded-lg border p-4 text-left",
        "transition-[border-color,background-color,box-shadow] duration-150",
        checked
          ? "border-brand bg-brand-soft/60 shadow-soft"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-subtle",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
      />

      {media}

      <span className="flex items-start gap-3">
        {Icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              checked ? "bg-brand text-brand-fg" : "bg-surface-subtle text-fg-muted",
            )}
          >
            <Icon aria-hidden="true" className="size-[1.125rem]" />
          </span>
        ) : null}

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-fg">{title}</span>
            {badge}
          </span>
          {description ? (
            <span className="mt-1 block text-xs leading-relaxed text-fg-muted">{description}</span>
          ) : null}
        </span>

        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border",
            checked ? "border-brand bg-brand text-brand-fg" : "border-border-strong",
          )}
        >
          {checked ? <Check className="size-3" /> : null}
        </span>
      </span>
    </label>
  );
}

export type OptionGridProps = {
  /** Onzichtbare titel van de groep, voor schermlezers. */
  legend: string;
  columns?: 2 | 3;
  children: ReactNode;
  className?: string;
};

export function OptionGrid({ legend, columns = 2, children, className }: OptionGridProps) {
  return (
    <fieldset
      className={cn(
        "grid grid-cols-1 gap-3",
        columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        className,
      )}
    >
      <legend className="sr-only">{legend}</legend>
      {children}
    </fieldset>
  );
}
