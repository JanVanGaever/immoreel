"use client";

import { Download, Film, RotateCcw } from "lucide-react";
import { ExportStatusBadge } from "@/components/exports/export-status-badge";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { aspectRatioCss } from "@/lib/aspect-ratios";
import { API_ROUTES } from "@/lib/constants";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/format";
import type { ExportResult } from "@/lib/exports";
import { cn } from "@/lib/utils";
import type { ID } from "@/types";

/**
 * Eén export op de downloadpagina.
 *
 * De kaart moet drie vragen beantwoorden zonder dat je iets hoeft aan te
 * klikken: is dit bestand klaar, wat zit erin, en wat kan ik ermee. Die
 * volgorde staat ook zo op de kaart — status bovenaan, techniek in het midden,
 * knoppen onderaan — en verandert niet met de status. Een kaart die van vorm
 * verandert terwijl je ernaar kijkt, laat je opnieuw zoeken.
 *
 * Wat wél verandert is het middenstuk: zolang er gerenderd wordt staat daar een
 * balk met de huidige stap, daarna de gemeten grootte, en bij een fout de
 * melding met een knop ernaast.
 */
export function ExportCard({
  result,
  projectId,
  mayRetry,
  isRetrying,
  onRetry,
}: {
  result: ExportResult;
  projectId: ID;
  /** Een kijker mag downloaden, maar niets opnieuw insturen. */
  mayRetry: boolean;
  isRetrying: boolean;
  onRetry: (presetId: ID) => void;
}) {
  const isBusy = result.status === "queued" || result.status === "processing" || result.status === "finalizing";
  const hasFailed = result.status === "failed";

  return (
    <Card className={cn("overflow-hidden", hasFailed && "border-danger/30")}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        <Poster result={result} projectId={projectId} />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-fg">{result.label}</h3>
              <p className="mt-0.5 truncate text-xs text-fg-muted">
                {result.platformLabel}
                {result.metadata ? ` · ${result.metadata.summary}` : null}
              </p>
            </div>
            <ExportStatusBadge status={result.status} />
          </div>

          {isBusy ? (
            <Meter
              value={result.progress}
              max={100}
              tone={result.status === "queued" ? "neutral" : "brand"}
              label={result.message}
              valueLabel={`${result.progress}%`}
              size="sm"
            />
          ) : null}

          {hasFailed && result.error ? (
            <Alert variant="danger" title={result.error.message}>
              {result.error.retryable
                ? "Dit lukt vaak wel bij een tweede poging."
                : "Een tweede poging geeft waarschijnlijk dezelfde fout. Pas eerst iets aan in de editor."}
            </Alert>
          ) : null}

          <ExportMetadata result={result} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 truncate font-mono text-xs text-fg-subtle" title={result.fileName}>
              {result.fileName}
            </p>

            <div className="flex shrink-0 items-center gap-2">
              {/* Alleen na een fout. Een afgewerkte render opnieuw insturen
                  levert bij een ongewijzigde montage exact dezelfde job op (zie
                  `src/workers/queue.ts`), dus die knop zou een belofte doen die
                  ze niet waarmaakt. */}
              {mayRetry && hasFailed ? (
                <Button
                  size="sm"
                  isLoading={isRetrying}
                  loadingLabel="Opnieuw insturen"
                  disabled={!result.preset}
                  title={
                    result.preset
                      ? undefined
                      : "Dit exportformaat bestaat niet meer; kies er een ander in de editor."
                  }
                  onClick={() => onRetry(result.presetId)}
                >
                  <RotateCcw />
                  Opnieuw proberen
                </Button>
              ) : null}

              {result.isDownloadable ? (
                <a
                  href={API_ROUTES.exportDownload(projectId, result.jobId)}
                  download={result.fileName}
                  className={buttonClasses("primary", "sm")}
                >
                  <Download />
                  Downloaden
                </a>
              ) : (
                <span className={cn(buttonClasses("secondary", "sm"), "opacity-55")} aria-disabled="true">
                  <Download />
                  Downloaden
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Het posterbeeld in de verhouding van de export zelf. Dat kader doet meer werk
 * dan het lijkt: het laat in één oogopslag zien dat de staande en de liggende
 * versie van dezelfde video hier naast elkaar staan.
 */
function Poster({ result, projectId }: { result: ExportResult; projectId: ID }) {
  const ratio = result.metadata?.aspectRatio ?? "16:9";

  return (
    <div
      className="relative w-full shrink-0 overflow-hidden rounded-lg bg-surface-inset sm:w-28"
      style={{ aspectRatio: aspectRatioCss(ratio) }}
    >
      {result.hasPoster ? (
        // Komt uit onze eigen route met een korte cache; voor next/image valt
        // aan een still van 1080 breed niets te winnen.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={API_ROUTES.exportPoster(projectId, result.jobId)}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center">
          <Film aria-hidden="true" className="size-5 text-fg-subtle" />
        </span>
      )}
    </div>
  );
}

/**
 * De technische kant. Bewust altijd dezelfde rijen, ook zolang er nog
 * gerenderd wordt: wat een export wordt, ligt vast voor ze begint — alleen de
 * grootte is pas achteraf gemeten, en dat staat er dan ook bij.
 */
function ExportMetadata({ result }: { result: ExportResult }) {
  const { metadata } = result;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
      <Item label="Resolutie" value={metadata ? `${metadata.width}×${metadata.height}` : "—"} />
      <Item label="Verhouding" value={metadata?.aspectRatio ?? "—"} />
      <Item label="Beeldsnelheid" value={metadata ? `${metadata.fps} fps` : "—"} />
      <Item
        label="Duur"
        value={result.durationInSeconds !== null ? formatDuration(result.durationInSeconds) : "—"}
      />
      <Item
        label={result.sizeInBytes === null ? "Grootte (schatting)" : "Grootte"}
        value={
          result.sizeInBytes !== null
            ? formatBytes(result.sizeInBytes)
            : result.estimatedSizeInBytes !== null
              ? `± ${formatBytes(result.estimatedSizeInBytes)}`
              : "—"
        }
      />
      <Item label="Bestandstype" value={metadata ? metadata.container.toUpperCase() : "—"} />
      <Item
        label={result.status === "done" ? "Klaar op" : "Aangevraagd"}
        value={formatDateTime(result.finishedAt ?? result.queuedAt)}
        className="col-span-2"
      />
    </dl>
  );
}

function Item({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="truncate text-fg-subtle">{label}</dt>
      <dd className="truncate font-medium text-fg tabular-nums">{value}</dd>
    </div>
  );
}
