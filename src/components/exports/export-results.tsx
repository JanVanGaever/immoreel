"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Film, Pencil } from "lucide-react";
import { ExportCard } from "@/components/exports/export-card";
import { ExportOverviewPanel } from "@/components/exports/export-overview";
import { useRenderJobs } from "@/components/exports/use-render-jobs";
import { useRenderToasts } from "@/components/notifications";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-state";
import { ROUTES } from "@/lib/constants";
import { initialRetryState, type RetryState } from "@/lib/exports/action-state";
import { retryExportsAction } from "@/lib/exports/actions";
import { buildExportResults, summariseExports, type ExportProjectContext } from "@/lib/exports";
import type { ID, RenderJobSnapshot } from "@/types";

/**
 * De downloadpagina, vanaf het punt waar ze leeft.
 *
 * De server geeft de beginstand mee en dit component houdt hem bij. Dat gaat in
 * één richting: renderjobs komen binnen als snapshots, en de kaarten worden
 * daar telkens opnieuw uit gerekend met `buildExportResults` — dezelfde functie
 * die de server gebruikt. Er wordt hier dus nooit een kaart "bijgewerkt"; er
 * wordt een nieuwe stand berekend. Dat is het verschil tussen een pagina die na
 * tien minuten renderen nog klopt en een pagina waarvan je maar moet hopen.
 */
export function ExportResults({
  projectId,
  project,
  initialSnapshots,
  mayRetry,
}: {
  projectId: ID;
  /** Wat de bestandsnamen en de schattingen nodig hebben van het project. */
  project: ExportProjectContext;
  initialSnapshots: RenderJobSnapshot[];
  mayRetry: boolean;
}) {
  const feed = useRenderJobs(projectId, initialSnapshots);
  const [retry, setRetry] = useState<RetryState>(initialRetryState);
  /** Welke presets nu ingestuurd worden; per kaart, zodat de juiste knop draait. */
  const [pending, setPending] = useState<readonly ID[]>([]);
  const [isPending, startTransition] = useTransition();

  const results = useMemo(
    () => buildExportResults(feed.snapshots, project),
    [feed.snapshots, project],
  );
  const overview = useMemo(() => summariseExports(results), [results]);

  // Meekijken met wat er toch al binnenkomt: een export die tijdens het kijken
  // klaar of stuk raakt, is een toast waard. Zie `useRenderToasts`.
  useRenderToasts(projectId, project.title, results);

  function retryPresets(presetIds: readonly ID[]) {
    if (presetIds.length === 0) return;

    setPending(presetIds);

    startTransition(async () => {
      const state = await retryExportsAction(projectId, [...presetIds]);
      setRetry(state);

      // De server heeft de jobs net teruggezet; die stand meteen tonen scheelt
      // de seconden tot de eerstvolgende melding van de worker.
      if (state.status === "wachtrij") feed.apply(state.snapshots);

      setPending([]);
    });
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={Film}
        title="Nog geen exports"
        description="Zodra je in de editor een export start, verschijnt hier per platform een kaart met de voortgang en het afgewerkte bestand."
        action={
          <Link href={ROUTES.editor(projectId)} className={buttonClasses("primary", "md")}>
            <Pencil />
            Openen in editor
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ExportOverviewPanel
        overview={overview}
        projectId={projectId}
        feed={feed.status}
        mayRetry={mayRetry}
        isRetrying={isPending && pending.length > 1}
        onRetryFailed={() => retryPresets(overview.retryablePresetIds)}
      />

      {/* Twee soorten fouten, en ze zeggen iets anders. De eerste: het opnieuw
          insturen zelf lukte niet. De tweede: de voortgang komt niet meer
          binnen — de renders lopen dan misschien gewoon door, maar wat hier
          staat is niet meer actueel, en dat hoort de gebruiker te weten. */}
      {retry.status === "fout" ? (
        <ErrorAlert error={retry.message} className="mb-4" />
      ) : null}

      {feed.error ? (
        <ErrorAlert
          error={feed.error}
          hint="De voortgang hieronder loopt niet meer mee. Ververs de pagina voor de huidige stand; je exports gaan intussen gewoon door."
          className="mb-4"
        />
      ) : null}

      <ul className="space-y-3">
        {results.map((result) => (
          <li key={result.presetId}>
            <ExportCard
              result={result}
              projectId={projectId}
              mayRetry={mayRetry}
              isRetrying={isPending && pending.includes(result.presetId)}
              onRetry={(presetId) => retryPresets([presetId])}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
