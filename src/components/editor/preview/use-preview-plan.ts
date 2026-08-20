"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildPreviewPlan,
  previewPhotoSignature,
  previewSignature,
  type PreviewPlan,
} from "@/lib/editor/preview-plan";
import {
  createPreviewProxy,
  revokePreviewProxies,
  type PreviewProxy,
} from "@/lib/editor/preview-proxy";
import type { EditorDocument } from "@/lib/editor/document";

/**
 * Het plan waar de speler op draait, en de verkleinde foto's erbij.
 *
 * Hier zit het enige echte wachten van de preview. Een instelling wijzigen doet
 * drie dingen na elkaar:
 *
 * 1. even niets — zolang de gebruiker nog aan een schuifregelaar zit, heeft
 *    opbouwen geen zin;
 * 2. een nieuw plan;
 * 3. de foto's verkleinen, maar alleen die er nog niet zijn.
 *
 * Punt 3 is de reden dat een duur of een bijschrift bijstellen meteen klaar is
 * en een foto toevoegen niet: dat laatste is echt werk. De laadtoestand hoort
 * dus bij iets wat er ook is, en is geen animatie om het wachten te vullen.
 *
 * De verkleinde foto's zijn blob-URL's. Ze worden vrijgegeven zodra ze niet
 * meer in het plan voorkomen en bij het opruimen van de speler — anders houdt
 * een middag bijstellen tientallen kopieën in het geheugen.
 */

/** Hoelang er gewacht wordt op de volgende wijziging voor er opgebouwd wordt. */
export const RECOMPUTE_DELAY_MS = 220;

export type PreviewPlanState = {
  /** Het plan dat nu speelt; niet noodzakelijk het nieuwste document. */
  plan: PreviewPlan;
  /** De verkleinde foto's, op bron-URL. Ontbreekt er een, dan is die stuk. */
  photos: Map<string, PreviewProxy>;
  /** Loopt op bij elk nieuw plan; de speler begint daarop opnieuw. */
  revision: number;
  /** Het document is verder dan het plan: er komt een nieuwe preview aan. */
  isStale: boolean;
  /** Er worden foto's verkleind. */
  isBuilding: boolean;
  /** Samen: de preview is niet speelklaar. */
  isPreparing: boolean;
  /** Hoeveel foto's er al klaar zijn, van 0 tot 1. */
  progress: number;
};

export function usePreviewPlan(
  document: EditorDocument,
  { delayMs = RECOMPUTE_DELAY_MS }: { delayMs?: number } = {},
): PreviewPlanState {
  const signature = useMemo(() => previewSignature(document), [document]);

  const [committed, setCommitted] = useState(() => ({
    plan: buildPreviewPlan(document),
    revision: 0,
  }));

  // Bij het aflopen van de wachttijd wordt er gebouwd op het document van dát
  // moment, niet op dat van de wijziging die de klok startte.
  const documentRef = useRef(document);
  useEffect(() => {
    documentRef.current = document;
  });

  const isStale = signature !== committed.plan.signature;

  useEffect(() => {
    if (!isStale) return;

    const timer = setTimeout(() => {
      setCommitted((current) => ({
        plan: buildPreviewPlan(documentRef.current),
        revision: current.revision + 1,
      }));
    }, delayMs);

    return () => clearTimeout(timer);
  }, [isStale, signature, delayMs]);

  /* ---------------------------------------------------------------------
   * De foto's verkleinen
   * ------------------------------------------------------------------ */

  const { plan } = committed;

  const cacheRef = useRef(new Map<string, PreviewProxy>());
  const builtRef = useRef("");
  const [photos, setPhotos] = useState<Map<string, PreviewProxy>>(() => new Map());
  const [ready, setReady] = useState(0);
  const [isBuilding, setBuilding] = useState(plan.photoUrls.length > 0);

  useEffect(() => {
    // Een nieuw plan met dezelfde foto's in hetzelfde kader hoeft niets: een
    // duur of een bijschrift wijzigen raakt geen enkel beeld.
    const photoSignature = previewPhotoSignature(plan);
    if (photoSignature === builtRef.current) return;

    builtRef.current = photoSignature;
    const cache = cacheRef.current;

    // Wat nog voorkomt blijft; de rest wordt vrijgegeven. Zo kost een scène
    // verwijderen niets en een scène toevoegen alleen die ene foto.
    const stale: PreviewProxy[] = [];
    for (const [url, proxy] of cache) {
      if (!plan.photoUrls.includes(url)) {
        stale.push(proxy);
        cache.delete(url);
      }
    }
    revokePreviewProxies(stale);

    const todo = plan.photoUrls.filter((url) => !cache.has(url));

    setReady(plan.photoUrls.length - todo.length);
    setPhotos(new Map(cache));

    if (todo.length === 0) {
      setBuilding(false);
      return;
    }

    setBuilding(true);

    const controller = new AbortController();
    let cancelled = false;
    let finished = false;

    void (async () => {
      // Eén voor één: parallel verkleinen maakt het geheel niet sneller en
      // laat de rest van de editor wél haperen.
      for (const url of todo) {
        try {
          const proxy = await createPreviewProxy(url, { frame: plan.size, signal: controller.signal });

          if (cancelled) {
            revokePreviewProxies([proxy]);
            return;
          }

          cache.set(url, proxy);
        } catch {
          // Een foto die niet laadt houdt de preview niet tegen; die slide
          // toont haar bestandsnaam in plaats van een beeld.
        }

        if (cancelled) return;

        setReady((current) => current + 1);
        setPhotos(new Map(cache));
      }

      finished = true;
      setBuilding(false);
    })();

    return () => {
      cancelled = true;
      controller.abort();

      // Halverwege afgebroken: de volgende ronde moet opnieuw mogen beginnen,
      // ook als het plan dezelfde foto's vraagt.
      if (!finished) builtRef.current = "";
    };
  }, [plan]);

  // Bij het sluiten van de preview: alles vrijgeven.
  useEffect(() => {
    const cache = cacheRef.current;

    return () => {
      revokePreviewProxies(cache.values());
      cache.clear();
    };
  }, []);

  const total = plan.photoUrls.length;

  return {
    plan,
    photos,
    revision: committed.revision,
    isStale,
    isBuilding,
    isPreparing: isStale || isBuilding,
    progress: total === 0 ? 1 : Math.min(ready / total, 1),
  };
}
