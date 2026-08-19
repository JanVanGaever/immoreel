"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * De lus achter de mini-preview: de tijd loopt, de preview leest af.
 *
 * Dezelfde opzet als `usePlayback`, maar dan voor één scène en met een korte
 * pauze aan het einde. Die pauze is er met opzet: zonder rustpunt is er in een
 * doorlopende lus geen begin te zien, en juist het begin en het einde wil je
 * kunnen vergelijken.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(QUERY);

  media.addEventListener("change", listener);

  return () => media.removeEventListener("change", listener);
}

/**
 * Of de gebruiker liever geen bewegende beelden ziet. De mini-preview
 * respecteert dat en speelt dan alleen af als erom gevraagd wordt — de
 * instelling zelf blijft gewoon werken.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Rust tussen twee doorlopen van de lus. */
const HOLD_MS = 500;

export type MotionLoopOptions = {
  durationInSeconds: number;
  /** Uit zetten om stil te blijven staan op het eindbeeld. */
  loop: boolean;
  /**
   * Verandert deze waarde, dan begint de beweging opnieuw. Geef er de
   * instellingen in mee die je aan het bijstellen bent.
   */
  restartKey: string;
};

export type MotionLoop = {
  /** Positie in de scène, van 0 tot 1. */
  progress: number;
  /** Eén keer afspelen; voor wie bewegende beelden liever niet automatisch krijgt. */
  playOnce: () => void;
};

export function useMotionLoop({
  durationInSeconds,
  loop,
  restartKey,
}: MotionLoopOptions): MotionLoop {
  const [progress, setProgress] = useState(loop ? 0 : 1);
  const [runOnce, setRunOnce] = useState(0);

  const startedAtRef = useRef(0);
  const durationRef = useRef(durationInSeconds);

  useEffect(() => {
    durationRef.current = Math.max(durationInSeconds, 0.1);
  });

  // Een nieuwe instelling begint vooraan. Alleen de ref verzetten: de lus
  // hieronder pikt dat bij het volgende beeld vanzelf op.
  useEffect(() => {
    startedAtRef.current = 0;
  }, [restartKey]);

  const isRunning = loop || runOnce > 0;

  useEffect(() => {
    if (!isRunning) return;

    let frame = 0;
    startedAtRef.current = 0;

    const step = (now: number) => {
      if (startedAtRef.current === 0) startedAtRef.current = now;

      const elapsed = (now - startedAtRef.current) / 1000;
      const value = elapsed / durationRef.current;

      if (value >= 1) {
        setProgress(1);

        if (!loop) {
          // Eén doorloop is genoeg; blijf op het eindbeeld staan.
          setRunOnce(0);
          return;
        }

        if (elapsed * 1000 >= durationRef.current * 1000 + HOLD_MS) {
          startedAtRef.current = now;
        }
      } else {
        setProgress(value);
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [isRunning, loop, restartKey]);

  const playOnce = useCallback(() => {
    startedAtRef.current = 0;
    setRunOnce((current) => current + 1);
  }, []);

  return { progress, playOnce };
}
