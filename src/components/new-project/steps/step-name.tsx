"use client";

import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TITLE_MAX_LENGTH } from "@/lib/new-project/validation";

export type StepNameProps = {
  title: string;
  error?: string;
  onChange: (title: string) => void;
};

/** Stap 1: alleen een naam, zodat de gebruiker meteen binnen is. */
export function StepName({ title, error, onChange }: StepNameProps) {
  return (
    <FormField
      label="Projectnaam"
      hint="Meestal het adres van het pand. Zo vind je het project later snel terug."
      error={error}
      required
    >
      <Input
        name="title"
        value={title}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Leiestraat 44, Kortrijk"
        maxLength={TITLE_MAX_LENGTH}
        autoComplete="off"
        autoFocus
      />
    </FormField>
  );
}
