"use client";

import { CircleCheck, Download, RotateCcw, TriangleAlert } from "lucide-react";
import type { RenderFeedStatus } from "@/components/exports/use-render-jobs";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { API_ROUTES } from "@/lib/constants";
import type { ExportOverview } from "@/lib/exports";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ID } from "@/types";

/**
 * De strook bovenaan: hoe ver staat het geheel, en wat kan je nu doen.
 *
 * Eén blok dat drie standen kent — bezig, alles klaar, iets mislukt — in plaats
 * van drie blokken die om beurten verschijnen. Zo staat de knop "Alles
 * downloaden" altijd op dezelfde plek, ook terwijl de laatste render nog loopt.
 * Ze doet dan al iets zinnigs: wie drie van de vijf video's nu al nodig heeft,
 * krijgt die drie.
 */
export function ExportOverviewPanel({
  overview,
  projectId,
  feed,
  mayRetry,
  isRetrying,
  onRetryFailed,
}: {
  overview: ExportOverview;
  projectId: ID;
  feed: RenderFeedStatus;
  mayRetry: boolean;
  isRetrying: boolean;
  onRetryFailed: () => void;
}) {
  const canRetry = mayRetry && overview.retryablePresetIds.length > 0;

  return (
    <Card className={cn("mb-4 p-5", overview.allDone && "border-success/30 bg-success-soft/30")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Headline overview={overview} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canRetry ? (
            <Button
              variant="secondary"
              size="md"
              isLoading={isRetrying}
              loadingLabel="Opnieuw insturen"
              onClick={onRetryFailed}
            >
              <RotateCcw />
              {overview.retryablePresetIds.length === 1
                ? "Mislukte export opnieuw"
                : `${overview.retryablePresetIds.length} mislukte exports opnieuw`}
            </Button>
          ) : null}

          <DownloadAllButton overview={overview} projectId={projectId} />
        </div>
      </div>

      {overview.busy > 0 ? (
        <Meter
          className="mt-4"
          value={overview.progress}
          max={100}
          tone="brand"
          label={`${overview.done} van ${overview.total} klaar`}
          valueLabel={`${overview.progress}%`}
        />
      ) : null}

      <FeedNotice feed={feed} />
    </Card>
  );
}

/** De zin die de stand samenvat, met het icoon dat erbij hoort. */
function Headline({ overview }: { overview: ExportOverview }) {
  if (overview.allDone) {
    return (
      <>
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">
            {overview.total === 1
              ? "Je video staat klaar."
              : `Alle ${overview.total} exports staan klaar.`}
          </p>
          <p className="mt-0.5 text-sm text-fg-muted">
            Samen {formatBytes(overview.downloadableSizeInBytes)}. Elk bestand heeft het platform en
            het formaat in zijn naam staan, zodat je ze niet hoeft open te doen om ze uit elkaar te
            houden.
          </p>
        </div>
      </>
    );
  }

  if (overview.busy > 0) {
    return (
      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg">
          {overview.done} van {overview.total} exports klaar
        </p>
        <p className="mt-0.5 text-sm text-fg-muted">
          Je kan dit venster gerust sluiten: het renderen loopt door op de server.
        </p>
      </div>
    );
  }

  return (
    <>
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg">
          {overview.failed === 1
            ? "Eén export is mislukt."
            : `${overview.failed} exports zijn mislukt.`}
        </p>
        <p className="mt-0.5 text-sm text-fg-muted">
          {overview.done > 0
            ? `De andere ${overview.done} staan wel klaar om te downloaden.`
            : "Er staat nog niets klaar om te downloaden."}
        </p>
      </div>
    </>
  );
}

/**
 * Alles in één zip. Geen knop met een teller erin ("Download 3 bestanden") maar
 * één met de maat erbij: wie op mobiele data zit, wil weten waar hij aan begint.
 */
function DownloadAllButton({ overview, projectId }: { overview: ExportOverview; projectId: ID }) {
  const label =
    overview.downloadableCount > 0
      ? `Alles downloaden (${overview.downloadableCount}${
          overview.downloadableSizeInBytes > 0
            ? ` · ${formatBytes(overview.downloadableSizeInBytes)}`
            : ""
        })`
      : "Alles downloaden";

  if (overview.downloadableCount === 0) {
    return (
      <span
        aria-disabled="true"
        title="Er staat nog geen enkele export klaar."
        className={cn(buttonClasses("secondary", "md"), "opacity-55")}
      >
        <Download />
        {label}
      </span>
    );
  }

  return (
    <a
      href={API_ROUTES.exportArchive(projectId)}
      // De zip wordt geschreven terwijl hij verstuurd wordt, dus de naam komt
      // uit de `Content-Disposition` van de server en niet van hier.
      download
      className={buttonClasses("primary", "md")}
    >
      <Download />
      {label}
    </a>
  );
}

/**
 * Alleen iets zeggen als er iets te zeggen valt. Dat de eventstroom werkt, is
 * geen nieuws; dat ze weggevallen is en de pagina daarom zelf gaat kijken, wel
 * — anders lijkt een balk die trager bijspringt een balk die hapert.
 *
 * Het verbinden zelf is ook geen nieuws: dat duurt een fractie van een seconde
 * en een waarschuwing die meteen weer verdwijnt, leest als een storing.
 */
function FeedNotice({ feed }: { feed: RenderFeedStatus }) {
  if (feed === "idle" || feed === "live" || feed === "connecting") return null;

  return (
    <p className="mt-3 text-xs text-fg-subtle">
      {feed === "polling"
        ? "De live verbinding is niet beschikbaar; de stand wordt om de paar seconden opgevraagd."
        : "Even geen verbinding met de server. De pagina probeert het opnieuw."}
    </p>
  );
}
