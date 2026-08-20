"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { initialBrandKitState, type BrandKitState } from "@/lib/brand/action-state";
import { saveBrandKitAction } from "@/lib/brand/actions";
import { createBrandKitInput, resolveBrand, type BrandPreset } from "@/lib/brand/kit";
import {
  brandKitWarnings,
  hasErrors,
  sanitizeBrandKit,
  validateBrandKit,
  type BrandKitErrors,
  type BrandKitField,
  type BrandKitWarning,
} from "@/lib/brand/validation";
import type { BrandContact, BrandKit, BrandKitInput, ResolvedBrand } from "@/types";

/**
 * De staat van het huisstijlformulier.
 *
 * Twee dingen zijn hier bewust geregeld en zouden anders in het component
 * rondslingeren:
 *
 * - **Wanneer een fout mag verschijnen.** Tijdens het typen van `#0f5` is een
 *   melding over een ongeldige hexcode gewoon vervelend. Een veld gaat pas
 *   "aangeraakt" heten zodra je het verlaat; bij het bewaren worden ze dat
 *   allemaal in één keer.
 * - **Wat de preview toont.** Niet de bewaarde kit, maar wat er nú in het
 *   formulier staat. Daardoor is de eindkaart rechts een preview en geen
 *   samenvatting.
 */

export type BrandKitFormController = {
  values: BrandKitInput;
  /** De huisstijl zoals de preview ze toont: wat er nu in het formulier staat. */
  brand: ResolvedBrand;
  errors: BrandKitErrors;
  warnings: BrandKitWarning[];
  state: BrandKitState;
  isPending: boolean;
  /** Wijkt het formulier af van wat er bewaard is? */
  isDirty: boolean;
  set(changes: Partial<BrandKitInput>): void;
  setContact(changes: Partial<BrandContact>): void;
  applyPreset(preset: BrandPreset): void;
  /** Markeert een veld als aangeraakt; roep dit bij `onBlur`. */
  touch(field: BrandKitField): void;
  save(): void;
  reset(): void;
};

export function useBrandKitForm(kit: BrandKit): BrandKitFormController {
  const [saved, setSaved] = useState<BrandKit>(kit);
  const [values, setValues] = useState<BrandKitInput>(() => createBrandKitInput(kit));
  const [touched, setTouched] = useState<Set<BrandKitField>>(new Set());
  const [state, setState] = useState<BrandKitState>(initialBrandKitState);
  const [isPending, startTransition] = useTransition();

  const allErrors = useMemo(() => validateBrandKit(sanitizeBrandKit(values)), [values]);

  const errors = useMemo(() => {
    // Wat de server terugstuurde blijft staan tot er iets verandert: elke
    // wijziging zet `state` terug op idle, en dan verdwijnt de melding vanzelf.
    const visible: BrandKitErrors = state.status === "fout" ? { ...state.fieldErrors } : {};

    for (const [field, message] of Object.entries(allErrors) as [BrandKitField, string][]) {
      if (touched.has(field)) visible[field] = message;
    }

    return visible;
  }, [allErrors, touched, state]);

  const warnings = useMemo(() => brandKitWarnings(sanitizeBrandKit(values)), [values]);

  const brand = useMemo(() => {
    // De preview mag niet omvallen op een half getypte kleur, dus ze kijkt
    // naar de rechtgetrokken versie — precies wat er bewaard zou worden.
    const clean = sanitizeBrandKit(values);

    return resolveBrand({ ...saved, ...clean });
  }, [values, saved]);

  const isDirty = useMemo(
    () => JSON.stringify(sanitizeBrandKit(values)) !== JSON.stringify(createBrandKitInput(saved)),
    [values, saved],
  );

  /** Elke wijziging maakt de vorige serverreactie oud nieuws. */
  const clearServerState = useCallback(() => setState(initialBrandKitState), []);

  const set = useCallback(
    (changes: Partial<BrandKitInput>) => {
      clearServerState();
      setValues((current) => ({ ...current, ...changes }));
    },
    [clearServerState],
  );

  const setContact = useCallback(
    (changes: Partial<BrandContact>) => {
      clearServerState();
      setValues((current) => ({ ...current, contact: { ...current.contact, ...changes } }));
    },
    [clearServerState],
  );

  const applyPreset = useCallback(
    (preset: BrandPreset) => {
      set({
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        fontId: preset.fontId,
      });
    },
    [set],
  );

  const touch = useCallback((field: BrandKitField) => {
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  }, []);

  const save = useCallback(() => {
    const clean = sanitizeBrandKit(values);
    const found = validateBrandKit(clean);

    if (hasErrors(found)) {
      // Alles zichtbaar maken: bij het bewaren wil je élke fout zien, niet
      // alleen die in de velden waar je toevallig geweest bent.
      setTouched(new Set(Object.keys(found) as BrandKitField[]));
      setState({
        status: "fout",
        message: "Er ontbreekt nog iets. Kijk de gemarkeerde velden na.",
        fieldErrors: found,
      });
      return;
    }

    startTransition(async () => {
      const result = await saveBrandKitAction(clean);

      setState(result);

      if (result.status === "opgeslagen") {
        setSaved(result.kit);
        setValues(createBrandKitInput(result.kit));
        setTouched(new Set());
      } else if (result.status === "fout") {
        setTouched(new Set(Object.keys(result.fieldErrors ?? {}) as BrandKitField[]));
      }
    });
  }, [values]);

  const reset = useCallback(() => {
    setValues(createBrandKitInput(saved));
    setTouched(new Set());
    setState(initialBrandKitState);
  }, [saved]);

  return {
    values,
    brand,
    errors,
    warnings,
    state,
    isPending,
    isDirty,
    set,
    setContact,
    applyPreset,
    touch,
    save,
    reset,
  };
}
