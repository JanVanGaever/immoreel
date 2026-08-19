"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * De afspeelkop van de preview.
 *
 * Er wordt niets gerenderd en niets gedecodeerd: de tijd loopt, en de preview
 * leest bij elk beeld af waar ze staat. Daardoor is de preview meteen juist
 * zodra een instelling wijzigt — er is geen tussenstap die opnieuw gemaakt
 * moet worden.
 *
 * `playRange` speelt één stuk in herhaling. Dat is wat je wil terwijl je aan
 * de beweging van één foto zit: die scène blijft lopen tot je iets anders
 * kiest.
 */

export type PlaybackRange = { from: number; to: number };

export type PlaybackController = {
  /** Positie in seconden. */
  time: number;
  isPlaying: boolean;
  /** Het stuk dat in herhaling speelt; `null` als de hele video speelt. */
  range: PlaybackRange | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stop: () => void;
  seek: (time: number) => void;
  playRange: (range: PlaybackRange) => void;
};

export function usePlayback(durationInSeconds: number): PlaybackController {
  const [time, setTime] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [range, setRange] = useState<PlaybackRange | null>(null);

  const frameRef = useRef<number | null>(null);
  const durationRef = useRef(durationInSeconds);
  const rangeRef = useRef(range);

  useEffect(() => {
    durationRef.current = durationInSeconds;
    rangeRef.current = range;
  });

  useEffect(() => {
    if (!isPlaying) return;

    let previous = performance.now();

    const step = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;

      setTime((current) => {
        const active = rangeRef.current;
        const start = active?.from ?? 0;
        const end = active?.to ?? durationRef.current;
        const next = current + delta;

        if (next < end) return next;

        // Aan het einde begint het opnieuw: een lus laat je een beweging
        // beoordelen zonder telkens op play te duwen.
        return start;
      });

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [isPlaying]);

  const play = useCallback(() => {
    setRange(null);
    setPlaying(true);
  }, []);

  const pause = useCallback(() => setPlaying(false), []);

  const toggle = useCallback(() => {
    setPlaying((current) => {
      if (current) return false;

      setRange(null);
      return true;
    });
  }, []);

  const stop = useCallback(() => {
    setPlaying(false);
    setRange(null);
    setTime(0);
  }, []);

  const seek = useCallback((next: number) => {
    setTime(Math.min(Math.max(next, 0), durationRef.current));
  }, []);

  const playRange = useCallback((next: PlaybackRange) => {
    setRange(next);
    setTime(next.from);
    setPlaying(true);
  }, []);

  return {
    // Wordt de video korter, dan valt de kop terug binnen de tijdlijn. Dat
    // gebeurt bij het uitlezen en niet in een effect: zo is er geen tweede
    // render nodig om een stand te tonen die al vaststaat.
    time: Math.min(time, durationInSeconds),
    isPlaying,
    range,
    play,
    pause,
    toggle,
    stop,
    seek,
    playRange,
  };
}
