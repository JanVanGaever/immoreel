"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_ROUTES } from "@/lib/constants";
import { isTerminalStatus } from "@/lib/render/status";
import type { ID, RenderJobSnapshot } from "@/types";

/**
 * Meekijken met de renders van één project.
 *
 * Er zijn twee manieren om te weten hoe ver een render staat, en deze hook
 * gebruikt ze allebei — in die volgorde. Eerst de eventstroom: die tikt mee met
 * de worker, dus de balk loopt zoals het renderen loopt. Valt die weg — geen
 * wachtrij geconfigureerd, een proxy die geen SSE doorlaat, een netwerk dat
 * anders beslist — dan schakelt de hook over op pollen. Dat is trager, maar het
 * werkt overal, en een balk die om de paar seconden bijspringt is oneindig veel
 * beter dan een balk die stilstaat terwijl het bestand al klaar is.
 *
 * Zodra er niets meer beweegt, stopt allebei. Een pagina met vijf afgewerkte
 * exports hoort geen open verbinding en geen verkeer meer te veroorzaken.
 */

export type RenderFeedStatus =
  /** Alles is klaar of mislukt; er valt niets meer te volgen. */
  | "idle"
  /** De eerste verbinding wordt gelegd; nog geen nieuws is goed nieuws. */
  | "connecting"
  /** De eventstroom staat open: voortgang komt binnen zodra ze er is. */
  | "live"
  /** Terugval: we vragen het om de paar seconden zelf op. */
  | "polling"
  /** De verbinding is weggevallen en probeert zichzelf te herstellen. */
  | "offline";

export type RenderFeed = {
  snapshots: RenderJobSnapshot[];
  status: RenderFeedStatus;
  /** Zelf een stand binnenbrengen, bijvoorbeeld na het opnieuw insturen. */
  apply: (incoming: readonly RenderJobSnapshot[]) => void;
};

/** Hoe vaak we het zelf gaan vragen wanneer de eventstroom niet werkt. */
const POLL_INTERVAL_MS = 4_000;

export function useRenderJobs(projectId: ID, initial: readonly RenderJobSnapshot[]): RenderFeed {
  const [byJob, setByJob] = useState<Record<ID, RenderJobSnapshot>>(() => index(initial));
  /** Blijft staan zolang deze pagina open is: eenmaal terugvallen is terugvallen. */
  const [pollOnly, setPollOnly] = useState(false);
  /** De stand van de eventstroom. Wordt alleen gezet vanuit de verbinding zelf. */
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");

  const apply = useCallback((incoming: readonly RenderJobSnapshot[]) => {
    setByJob((current) => merge(current, incoming));
  }, []);

  const snapshots = useMemo(() => Object.values(byJob), [byJob]);
  const isActive = snapshots.some((snapshot) => !isTerminalStatus(snapshot.status));

  // De handler zit in een ref: hij verandert bij elke render, en dat mag de
  // verbinding niet elke keer opnieuw opbouwen.
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  useEffect(() => {
    if (!isActive) return;

    if (pollOnly) return poll(projectId, (incoming) => applyRef.current(incoming));

    const source = new EventSource(API_ROUTES.projectRenderStream(projectId));

    source.addEventListener("open", () => setConnection("live"));

    source.addEventListener("render", (event) => {
      const snapshot = parse((event as MessageEvent<string>).data);
      if (snapshot) applyRef.current([snapshot]);
    });

    source.addEventListener("error", () => {
      setConnection("offline");

      // `CLOSED` betekent dat de browser het opgeeft — een 503 of een 404, geen
      // hapering. Dan heeft wachten geen zin en gaan we het zelf vragen.
      if (source.readyState === EventSource.CLOSED) setPollOnly(true);
    });

    return () => {
      source.close();
      setConnection("connecting");
    };
  }, [projectId, isActive, pollOnly]);

  // Afgeleid en niet bijgehouden: er is geen stand van deze hook die niet uit
  // deze drie volgt, en een vierde variabele zou alleen maar uit de pas kunnen
  // gaan lopen met de andere drie.
  const status: RenderFeedStatus = !isActive ? "idle" : pollOnly ? "polling" : connection;

  return { snapshots, status, apply };
}

/** Om de paar seconden de stand opvragen. Geeft de opruimfunctie terug. */
function poll(projectId: ID, onSnapshots: (snapshots: RenderJobSnapshot[]) => void): () => void {
  const controller = new AbortController();

  const tick = async (): Promise<void> => {
    try {
      const response = await fetch(API_ROUTES.projectRenders(projectId), {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) return;

      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("jobs" in payload)) return;

      const jobs = (payload as { jobs: unknown }).jobs;
      if (Array.isArray(jobs)) onSnapshots(jobs as RenderJobSnapshot[]);
    } catch {
      // Een mislukte poging is geen ramp: de volgende komt er zo aan.
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);

  return () => {
    clearInterval(timer);
    controller.abort();
  };
}

function index(snapshots: readonly RenderJobSnapshot[]): Record<ID, RenderJobSnapshot> {
  const result: Record<ID, RenderJobSnapshot> = {};

  for (const snapshot of snapshots) result[snapshot.jobId] = snapshot;

  return result;
}

/**
 * Nieuwe standen erin, oudere eruit.
 *
 * Berichten kunnen in de verkeerde volgorde aankomen — een poll die traag was
 * naast een event dat sneller was — en dan mag een afgewerkte render niet
 * terugvallen naar 80%. `updatedAt` beslist, want dat is het moment waarop de
 * server die stand geschreven heeft.
 */
function merge(
  current: Record<ID, RenderJobSnapshot>,
  incoming: readonly RenderJobSnapshot[],
): Record<ID, RenderJobSnapshot> {
  let changed = false;
  const next = { ...current };

  for (const snapshot of incoming) {
    const existing = next[snapshot.jobId];

    // Ouder dan wat we al weten; een trage poll naast een sneller event.
    if (existing && snapshot.updatedAt < existing.updatedAt) continue;

    const merged = combine(existing, snapshot);
    if (!merged) continue;
    if (existing && JSON.stringify(existing) === JSON.stringify(merged)) continue;

    next[snapshot.jobId] = merged;
    changed = true;
  }

  return changed ? next : current;
}

/**
 * Een snapshot zonder preset komt uit de terugval in de stream-route: een
 * worker in een ander proces meldt voortgang, maar de rij zelf is hier niet te
 * lezen. Daar staat alleen voortgang in, dus alleen voortgang nemen we over —
 * de bestandsnaam en het formaat van de kaart blijven staan.
 */
function combine(
  existing: RenderJobSnapshot | undefined,
  incoming: RenderJobSnapshot,
): RenderJobSnapshot | null {
  if (incoming.presetId) return incoming;
  if (!existing) return null;

  return {
    ...existing,
    status: incoming.status,
    stage: incoming.stage,
    progress: incoming.progress,
    message: incoming.message,
    updatedAt: incoming.updatedAt,
  };
}

function parse(data: string): RenderJobSnapshot | null {
  try {
    return JSON.parse(data) as RenderJobSnapshot;
  } catch {
    return null;
  }
}
