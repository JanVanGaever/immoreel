import { getProjectStore } from "@/db/project-store";
import { getRenderJobStore } from "@/db/render-job-store";
import { can } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { describeProgress, toRenderJobSnapshot } from "@/lib/render/status";
import { isQueueConfigured } from "@/workers/config";
import { subscribeToRenderEvents } from "@/workers/events";
import type { ID, RenderJobSnapshot, RenderProgressEvent } from "@/types";

/**
 * Meekijken met de renders van dit project, via server-sent events.
 *
 * Geen websocket: het verkeer gaat maar één kant op — de server vertelt, de
 * browser luistert. SSE geeft daar precies genoeg voor, met herverbinden
 * ingebouwd in `EventSource` en zonder tweede protocol naast HTTP. Wie later
 * toch een websocket wil (bijvoorbeeld om te annuleren), leest dezelfde
 * eventstroom uit `subscribeToRenderEvents`.
 *
 * Elk bericht is een volledige `RenderJobSnapshot`. Dat is meer bytes dan een
 * los percentage, maar het maakt de client dom: geen samenvoegen van deelstaten,
 * en een gemiste boodschap haalt zichzelf bij het volgende bericht weer in.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zonder teken van leven sluiten proxies een stille verbinding af. */
const HEARTBEAT_MS = 25_000;

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Niet ingelogd.", { status: 401 });
  if (!can(session.role, "project:view")) return new Response("Onvoldoende rechten.", { status: 403 });

  const { projectId } = await params;
  const organisationId = session.organisation.id;

  const project = await getProjectStore().findProject(organisationId, projectId);
  if (!project) return new Response("Onbekend project.", { status: 404 });

  if (!isQueueConfigured()) {
    // Beter een duidelijke 503 dan een verbinding die eeuwig niets stuurt.
    return new Response("De renderwachtrij is niet geconfigureerd.", { status: 503 });
  }

  const store = getRenderJobStore();
  const encoder = new TextEncoder();
  const known = new Set<ID>();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;

      const send = (payload: string): void => {
        if (!open) return;

        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // De browser is weg voor het abort-signaal binnen was.
          open = false;
        }
      };

      const sendSnapshot = (snapshot: RenderJobSnapshot): void => {
        send(`event: render\ndata: ${JSON.stringify(snapshot)}\n\n`);
      };

      // Beginnen met de huidige stand: wie later aansluit, ziet meteen waar
      // het staat in plaats van te wachten op de volgende beweging.
      for (const job of await store.listForProject(organisationId, projectId)) {
        known.add(job.id);
        sendSnapshot(toRenderJobSnapshot(job));
      }

      const unsubscribe = subscribeToRenderEvents((event) => {
        void (async () => {
          const record = await store.find(event.jobId);

          if (record) {
            if (record.organisationId !== organisationId || record.projectId !== projectId) return;

            known.add(record.id);
            sendSnapshot(toRenderJobSnapshot(record));

            return;
          }

          // Geen rij in de store: dan is de worker een ander proces en komt de
          // voortgang uit het event zelf.
          if (event.type !== "progress" || !event.progress) return;
          if (event.progress.projectId !== projectId && !known.has(event.jobId)) return;

          known.add(event.jobId);
          sendSnapshot(fromProgressEvent(event.progress));
        })();
      });

      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      const close = async (): Promise<void> => {
        if (!open) return;
        open = false;

        clearInterval(heartbeat);
        await unsubscribe();

        try {
          controller.close();
        } catch {
          // Al gesloten; niets aan te doen en niets aan de hand.
        }
      };

      request.signal.addEventListener("abort", () => void close(), { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Nginx buffert een eventstroom anders tot ze niets meer waard is.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Wat we van een job weten als alleen het voortgangsevent er is. */
function fromProgressEvent(progress: RenderProgressEvent): RenderJobSnapshot {
  return {
    jobId: progress.jobId,
    projectId: progress.projectId,
    presetId: "",
    status: progress.status,
    stage: progress.stage,
    progress: progress.progress,
    message: progress.message || describeProgress(progress.status, progress.stage),
    outputUrl: null,
    posterUrl: null,
    sizeInBytes: null,
    durationInSeconds: null,
    error: null,
    queuedAt: progress.at,
    startedAt: null,
    finishedAt: null,
    updatedAt: progress.at,
  };
}
