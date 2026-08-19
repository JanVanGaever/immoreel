"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Automatisch bewaren.
 *
 * De hook kent maar één bron: de waarde die binnenkomt. Verandert die, dan is
 * er iets te bewaren — geen enkel component hoeft dat te melden, en er is dus
 * ook geen scherm dat het kan vergeten.
 *
 * Drie dingen maken het verschil tussen dit en een `setTimeout`:
 *
 * - **Nooit twee keer tegelijk.** Terwijl er bewaard wordt, wacht een nieuwe
 *   wijziging; daarna gaat de laatste stand de deur uit, niet elke tussenstap.
 * - **Eerlijk over de stand.** Wat er onderweg is wordt vergeleken met wat er
 *   nú in het scherm staat. Zo staat er "Bewaard" alleen als dat ook klopt.
 * - **Mislukken is geen einde.** De wijziging blijft als niet-bewaard staan en
 *   kan opnieuw; er gaat niets stilletjes verloren.
 */

export type SaveStatus = "bewaard" | "wijzigingen" | "bezig" | "mislukt";

export type SaveOutcome = {
  ok: boolean;
  /** ISO-tijdstip zoals de server het bewaard heeft. */
  savedAt?: string;
  message?: string;
};

export type UseAutosaveOptions<T> = {
  value: T;
  save: (value: T) => Promise<SaveOutcome>;
  /** Hoe lang we wachten nadat het wijzigen stopt. */
  delayMs?: number;
  /** Uit zetten zolang er niets te bewaren valt, bijvoorbeeld voor een kijker. */
  enabled?: boolean;
};

export type AutosaveController = {
  status: SaveStatus;
  /** Wanneer er voor het laatst iets bewaard is; `null` zolang dat nog niet gebeurd is. */
  savedAt: string | null;
  error: string | null;
  isDirty: boolean;
  /** Meteen bewaren, zonder te wachten. */
  saveNow: () => void;
};

const DEFAULT_DELAY_MS = 900;

export function useAutosave<T>({
  value,
  save,
  delayMs = DEFAULT_DELAY_MS,
  enabled = true,
}: UseAutosaveOptions<T>): AutosaveController {
  const [status, setStatus] = useState<SaveStatus>("bewaard");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serialized = JSON.stringify(value);

  const valueRef = useRef(value);
  const serializedRef = useRef(serialized);
  /** Wat er als laatste met succes bewaard is; hieraan meten we "gewijzigd". */
  const savedSerializedRef = useRef(serialized);
  const isSavingRef = useRef(false);
  const saveRef = useRef(save);

  // Refs worden ná de render bijgewerkt: tijdens de render zijn ze niet
  // veilig te schrijven, en de timer hieronder leest ze pas daarna.
  useEffect(() => {
    valueRef.current = value;
    serializedRef.current = serialized;
    saveRef.current = save;
  });

  const run = useCallback(async () => {
    if (isSavingRef.current) return;

    const attempt = serializedRef.current;
    if (attempt === savedSerializedRef.current) return;

    isSavingRef.current = true;
    setStatus("bezig");

    try {
      const outcome = await saveRef.current(valueRef.current);

      if (!outcome.ok) {
        setStatus("mislukt");
        setError(outcome.message ?? "Bewaren is niet gelukt.");
        return;
      }

      savedSerializedRef.current = attempt;
      setSavedAt(outcome.savedAt ?? new Date().toISOString());
      setError(null);
      // Tijdens het bewaren kan er alweer iets gewijzigd zijn; dan is dit
      // scherm niet "bewaard", en het effect hieronder plant meteen opnieuw.
      setStatus(serializedRef.current === attempt ? "bewaard" : "wijzigingen");
    } catch {
      setStatus("mislukt");
      setError("Geen verbinding met de server.");
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (serialized === savedSerializedRef.current) return;
    if (isSavingRef.current) return;

    setStatus((current) => (current === "mislukt" ? current : "wijzigingen"));
    const timer = setTimeout(() => void run(), delayMs);

    return () => clearTimeout(timer);
    // `status` hoort erbij: na een mislukte of net afgeronde poging die nog
    // wijzigingen achterliet, moet er opnieuw een poging ingepland worden.
  }, [serialized, enabled, delayMs, run, status]);

  const isDirty = status === "wijzigingen" || status === "bezig" || status === "mislukt";

  // Het tabblad sluiten met werk dat nog niet weg is, hoort een vraag te zijn.
  useEffect(() => {
    if (!isDirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const saveNow = useCallback(() => void run(), [run]);

  return { status, savedAt, error, isDirty, saveNow };
}
