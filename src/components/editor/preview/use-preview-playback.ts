"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PREVIEW_FPS } from "@/lib/editor/preview-plan";

/**
 * De afspeelkop van de previewspeler.
 *
 * Anders dan `usePlayback` in de editor telt deze in beelden en niet in
 * seconden. Dat doet twee dingen tegelijk. Het maakt de preview eerlijk — ze
 * loopt op 24 beelden per seconde, net als een video, en niet op de
 * kloksnelheid van het scherm. En het scheelt werk: op een scherm van 120 Hz
 * hertekent de speler viermaal minder vaak, want tussen twee beelden valt er
 * niets te tonen.
 *
 * `canPlay` is het tweede verschil. Terwijl de preview opnieuw opgebouwd wordt
 * staat de kop stil zonder dat "afspelen" uitgaat: zodra het nieuwe plan klaar
 * is, loopt ze verder. Op de knop blijft pauze staan, want dat is wat er
 * gebeurt — de gebruiker heeft niets gestopt.
 *
 * Opnieuw beginnen bij een gewijzigde instelling zit hier niét in. Dat doet de
 * speler met een `key` op de lopende preview: die hoort bij één plan, en een
 * nieuw plan is een nieuwe preview.
 */

export type PreviewPlaybackOptions = {
  durationInSeconds: number;
  /** Zolang dit `false` is staat de kop stil; "afspelen" blijft wel aan. */
  canPlay: boolean;
  /** Vanzelf beginnen. Uit bij `prefers-reduced-motion`. */
  autoPlay: boolean;
  fps?: number;
};

export type PreviewPlayback = {
  /** Positie in seconden, altijd op een heel beeld. */
  time: number;
  /** Het beeldnummer zelf. */
  frame: number;
  isPlaying: boolean;
  /** De kop staat op het einde; afspelen begint dan weer vooraan. */
  isEnded: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  seek: (timeInSeconds: number) => void;
};

export function usePreviewPlayback({
  durationInSeconds,
  canPlay,
  autoPlay,
  fps = PREVIEW_FPS,
}: PreviewPlaybackOptions): PreviewPlayback {
  const totalFrames = Math.max(Math.round(durationInSeconds * fps), 1);

  const [frame, setFrame] = useState(0);
  const [isPlaying, setPlaying] = useState(autoPlay);
  // Wordt de kop buiten de lus om verzet, dan moet de lus zich opnieuw ankeren.
  const [anchor, setAnchor] = useState(0);

  const frameRef = useRef(0);
  const totalRef = useRef(totalFrames);
  const fpsRef = useRef(fps);

  useEffect(() => {
    totalRef.current = totalFrames;
    fpsRef.current = fps;
  });

  useEffect(() => {
    if (!isPlaying || !canPlay) return;

    // Uitgespeeld en dan opnieuw op play: vooraan beginnen. Het beeld dat daar
    // hoort wordt bij de eerste tik hieronder gezet, niet vanuit dit effect.
    const startFrame = frameRef.current >= totalRef.current ? 0 : frameRef.current;
    const startedAt = performance.now();

    let request = 0;

    const step = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      const next = Math.min(startFrame + Math.round(elapsed * fpsRef.current), totalRef.current);

      // Binnen hetzelfde beeld valt er niets te hertekenen.
      if (next !== frameRef.current) {
        frameRef.current = next;
        setFrame(next);
      }

      if (next >= totalRef.current) {
        setPlaying(false);
        return;
      }

      request = requestAnimationFrame(step);
    };

    request = requestAnimationFrame(step);

    return () => cancelAnimationFrame(request);
  }, [isPlaying, canPlay, anchor]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((current) => !current), []);

  const moveTo = useCallback((nextFrame: number) => {
    frameRef.current = nextFrame;
    setFrame(nextFrame);
    setAnchor((current) => current + 1);
  }, []);

  const restart = useCallback(() => {
    moveTo(0);
    setPlaying(true);
  }, [moveTo]);

  const seek = useCallback(
    (timeInSeconds: number) => {
      moveTo(Math.min(Math.max(Math.round(timeInSeconds * fpsRef.current), 0), totalRef.current));
    },
    [moveTo],
  );

  // Wordt de video korter, dan valt de kop terug binnen de tijdlijn. Dat
  // gebeurt bij het uitlezen: zo is er geen tweede render nodig voor een stand
  // die al vaststaat.
  const shown = Math.min(frame, totalFrames);

  return {
    time: Math.min(shown / fps, durationInSeconds),
    frame: shown,
    isPlaying,
    isEnded: shown >= totalFrames,
    play,
    pause,
    toggle,
    restart,
    seek,
  };
}
