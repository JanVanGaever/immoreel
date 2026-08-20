"use client";

import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ADMIN_PARAMS } from "@/lib/admin/query";

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterSelect = {
  name: string;
  label: string;
  value: string;
  options: FilterOption[];
};

export type FilterBarProps = {
  /** De pagina zelf; het formulier stuurt met GET naar hier terug. */
  action: string;
  search: string;
  searchPlaceholder: string;
  selects?: FilterSelect[];
  /**
   * Parameters die mee moeten maar niet in beeld staan — de filter op één
   * kantoor, bijvoorbeeld, gezet door een link vanaf een detailpagina.
   */
  hidden?: Record<string, string>;
  /** Of er iets te wissen valt; bepaalt of de resetknop zichtbaar is. */
  isFiltered: boolean;
};

/**
 * Zoeken en filteren, als een gewoon GET-formulier.
 *
 * Alles staat daardoor in de URL: een collega die de link uit een ticket opent,
 * ziet exact dezelfde lijst. Dat is ook waarom hier geen staat in React zit —
 * de enige regel JavaScript is dat een keuzelijst zichzelf indient, zodat je na
 * het kiezen van "Mislukt" niet ook nog op een knop moet.
 *
 * De paginateller staat bewust niet in het formulier: elke nieuwe filter begint
 * weer op pagina 1.
 */
export function FilterBar({
  action,
  search,
  searchPlaceholder,
  selects = [],
  hidden = {},
  isFiltered,
}: FilterBarProps) {
  function submitOnChange(event: ChangeEvent<HTMLSelectElement>) {
    event.currentTarget.form?.requestSubmit();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Lege velden horen niet in de URL: `?q=&status=` leest als een filter die
    // er niet is, en belandt zo wel in het ticket. Een uitgeschakeld veld gaat
    // niet mee; de formulierdata wordt hier synchroon genomen, dus meteen
    // daarna mag het veld weer aan — anders staat het scherm na een
    // client-side navigatie met dode keuzelijsten.
    const disabled: (HTMLInputElement | HTMLSelectElement)[] = [];

    for (const element of Array.from(event.currentTarget.elements)) {
      if (
        (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) &&
        element.value === "" &&
        element.type !== "hidden"
      ) {
        element.disabled = true;
        disabled.push(element);
      }
    }

    queueMicrotask(() => {
      for (const element of disabled) element.disabled = false;
    });
  }

  return (
    <form
      action={action}
      method="get"
      onSubmit={onSubmit}
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="min-w-56 flex-1">
        <Input
          type="search"
          name={ADMIN_PARAMS.search}
          defaultValue={search}
          placeholder={searchPlaceholder}
          leadingIcon={<Search />}
          inputSize="sm"
          aria-label="Zoeken"
        />
      </div>

      {selects.map((select) => (
        <Select
          key={select.name}
          name={select.name}
          defaultValue={select.value}
          onChange={submitOnChange}
          selectSize="sm"
          aria-label={select.label}
          className="w-auto"
        >
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ))}

      <Button type="submit" variant="secondary" size="sm">
        Zoeken
      </Button>

      {isFiltered ? (
        <Link href={action} className={buttonClasses("ghost", "sm")}>
          <RotateCcw />
          Wissen
        </Link>
      ) : null}
    </form>
  );
}
