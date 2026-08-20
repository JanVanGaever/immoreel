"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLogger } from "@/lib/errors/logger";
import { toAppError } from "@/lib/errors/normalize";
import { requestJson } from "@/lib/errors/request";
import { API_ROUTES } from "@/lib/constants";
import { isTerminalStatus } from "@/lib/render/status";
import type { AppErrorShape, ID, RenderJobSnapshot } from "@/types";

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
  /**
   * Waarom we niets meer horen, of `null` zolang het werkt.
   *
   * Bewust pas gevuld ná een reeks mislukte pogingen (`FAILURES_BEFORE_ALARM`).
   * Eén mislukte poll is geen nieuws — de volgende komt over vier seconden — en
   * een rode balk die om de vier seconden aan en uit gaat, is erger dan geen
   * balk. Blijft het misgaan, dan hoort de gebruiker te weten dat wat hij ziet
   * niet meer meebeweegt met wat er echt gebeurt.
   */
  error: AppErrorShape | null;
  /** Zelf een stand binnenbrengen, bijvoorbeeld na het opnieuw insturen. */
  apply: (incoming: readonly RenderJobSnapshot[]) => void;
};

/** Hoe vaak we het zelf gaan vragen wanneer de eventstroom niet werkt. */
const POLL_INTERVAL_MS = 4_000;

/** Zoveel pogingen op rij mislukt: nu is het geen hapering meer. */
const FAILURES_BEFORE_ALARM = 3;

const log = createLogger("render-feed");

export function useRenderJobs(projectId: ID, initial: readonly RenderJobSnapshot[]): RenderFeed {
  const [byJob, setByJob] = useState<Record<ID, RenderJobSnapshot>>(() => index(initial));
  /** Blijft staan zolang deze pagina open is: eenmaal terugvallen is terugvallen. */
  const [pollOnly, setPollOnly] = useState(false);
  /** De stand van de eventstroom. Wordt alleen gezet vanuit de verbinding zelf. */
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const [error, setError] = useState<AppErrorShape | null>(null);

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

    if (pollOnly) {
      return poll(projectId, {
        onSnapshots: (incoming) => applyRef.current(incoming),
        onFailure: setError,
      });
    }

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

  // Afgeleid en niet gewist: zodra alles klaar is, valt er niets meer te volgen
  // en is een melding over het volgen ook niet meer aan de orde.
  return { snapshots, status, error: isActive ? error : null, apply };
}

type PollHandlers = {
  onSnapshots: (snapshots: RenderJobSnapshot[]) => void;
  /** `null` zodra er weer een antwoord binnenkomt. */
  onFailure: (error: AppErrorShape | null) => void;
};

/**
 * Om de paar seconden de stand opvragen. Geeft de opruimfunctie terug.
 *
 * Eén mislukte poging is geen ramp: de volgende komt er zo aan, en de balk
 * blijft ondertussen staan waar hij stond. Pas na een reeks mislukkingen op rij
 * gaat de melding aan — dan is er iets aan de hand dat de gebruiker anders pas
 * merkt als hij de pagina ververst.
 */
function poll(projectId: ID, { onSnapshots, onFailure }: PollHandlers): () => void {
  const controller = new AbortController();
  let failures = 0;

  const tick = async (): Promise<void> => {
    try {
      const { jobs } = await requestJson<{ jobs: RenderJobSnapshot[] }>(
        API_ROUTES.projectRenders(projectId),
        { signal: controller.signal },
      );

      failures = 0;
      onFailure(null);

      if (Array.isArray(jobs)) onSnapshots(jobs);
    } catch (cause) {
      if (controller.signal.aborted) return;

      const failure = toAppError(cause, { context: { projectId } });

      failures += 1;
      log.warn("voortgang ophalen mislukt", {
        projectId,
        errorCode: failure.code,
        failures,
      });

      if (failures >= FAILURES_BEFORE_ALARM) onFailure(failure.toShape());
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
