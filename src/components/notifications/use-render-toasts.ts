"use client";

import { useEffect, useRef } from "react";
import { useNotifications } from "@/components/notifications/notification-provider";
import { describeEvent } from "@/lib/notifications/catalogue";
import { isTerminalStatus } from "@/lib/render/status";
import type { ExportResult } from "@/lib/exports";
import type { ID, NotificationPayload } from "@/types";

/**
 * De brug tussen de renderfeed en de toasts.
 *
 * Er is bewust geen tweede verbinding voor gebouwd. De downloadpagina volgt de
 * renders al (`useRenderJobs`: eventstroom met terugval op pollen), en die
 * stroom weet als eerste dat een export klaar of mislukt is — sneller dan de
 * bel, die om de minuut kijkt. Deze hook kijkt dus alleen mee naar wat er toch
 * al binnenkomt.
 *
 * Twee dingen die het verschil maken tussen "werkt" en "irritant":
 *
 * **Alleen overgangen.** Wie een pagina opent met drie afgewerkte exports,
 * krijgt geen drie toasts. De eerste ronde vult alleen de administratie; pas
 * een job die *tijdens het kijken* van lopend naar klaar gaat, is nieuws.
 *
 * **Eén keer per gebeurtenis.** De toast krijgt dezelfde sleutel als de melding
 * die de server ervoor bewaart (`dedupeKey`), en `toastOnce()` laat elke sleutel
 * één keer door. Of het nieuws nu via deze weg binnenkomt of via de bel: het
 * blijft één blokje.
 */
export function useRenderToasts(
  projectId: ID,
  projectTitle: string,
  results: readonly ExportResult[],
): void {
  const { toastOnce, refresh } = useNotifications();

  /** De laatst geziene stand per job; leeg tot de eerste ronde geweest is. */
  const seen = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const previous = seen.current;
    const current = new Map(results.map((result) => [result.jobId, result.status]));

    seen.current = current;

    // Eerste ronde: dit is de stand bij het openen van de pagina, geen nieuws.
    if (!previous) return;

    let arrived = false;

    for (const result of results) {
      const before = previous.get(result.jobId);

      // Nieuw op de pagina, of nog altijd hetzelfde: geen overgang.
      if (before === undefined || before === result.status) continue;
      if (!isTerminalStatus(result.status)) continue;

      const payload = payloadFor(result, projectId, projectTitle);
      if (!payload) continue;

      const content = describeEvent(payload);

      toastOnce(content.dedupeKey, {
        tone: content.tone,
        title: content.title,
        description: content.body,
        action:
          content.href && content.actionLabel
            ? { label: content.actionLabel, href: content.href }
            : undefined,
      });

      arrived = true;
    }

    // De server heeft hier net dezelfde melding voor bewaard. Even ophalen, dan
    // klopt het bolletje op de bel meteen in plaats van pas na een minuut.
    if (arrived) void refresh();
  }, [results, projectId, projectTitle, toastOnce, refresh]);
}

/**
 * Van een kaart op het scherm naar de gebeurtenis waar de tekst uit volgt.
 *
 * Dezelfde vorm als wat de worker aan `notify()` geeft, min de ids die de
 * browser niet heeft en voor een toast ook niet nodig zijn. Zo staat de zin
 * "Video klaar voor Kerkstraat 12" op precies één plek, of ze nu op het scherm
 * verschijnt of in een mail.
 */
function payloadFor(
  result: ExportResult,
  projectId: ID,
  projectTitle: string,
): NotificationPayload | null {
  if (result.status === "done") {
    return {
      topic: "render-klaar",
      projectId,
      projectTitle,
      jobId: result.jobId,
      presetLabel: result.label,
    };
  }

  if (result.status === "failed" && result.error) {
    return {
      topic: "render-mislukt",
      projectId,
      projectTitle,
      jobId: result.jobId,
      presetLabel: result.label,
      reason: result.error.message,
      code: result.error.code,
      retryable: result.error.retryable,
    };
  }

  return null;
}
