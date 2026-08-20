import type { Metadata } from "next";
import { FilterBar, LogList, Pagination } from "@/components/admin";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { getAdminStore } from "@/db/admin-store";
import { ADMIN_LOG_LEVEL_LABELS, ADMIN_LOG_SOURCE_LABELS } from "@/lib/admin/events";
import {
  ADMIN_PARAMS,
  LOG_LEVELS,
  LOG_SOURCES,
  parseLogQuery,
  type AdminSearchParams,
} from "@/lib/admin/query";
import { ADMIN_ROUTES } from "@/lib/admin/routes";

export const metadata: Metadata = { title: "Logs" };
export const dynamic = "force-dynamic";

/**
 * Alles wat er gebeurde, nieuwste eerst.
 *
 * De waarschuwing bovenaan is geen slag om de arm maar een kaart van het
 * gebied: wie hier iets níét vindt, moet weten waar hij dan wél moet zoeken.
 * De regels hieronder komen uit de opgeslagen tijdstempels; de uitvoer van de
 * renderworker staat als JSON in stdout en hoort in de logdienst thuis.
 */
export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = await searchParams;
  const query = parseLogQuery(params);
  const result = await getAdminStore().listLogs(query);

  return (
    <>
      <PageHeader
        title="Logs"
        description="Accounts, kantoren, projecten, renders en betalingen op één tijdlijn."
      />

      <Alert variant="info" className="mb-4" title="Afgeleid, niet verzameld.">
        Deze regels komen uit de tijdstempels die de app zelf bewaart — er is nog geen logdienst
        aangesloten. Wat de renderworker naar stdout schrijft (JSON, één regel per gebeurtenis, zie{" "}
        <code className="font-mono text-xs">src/workers/logger.ts</code>) staat hier dus niet in.
        Zoek daarvoor op het <code className="font-mono text-xs">jobId</code> uit de regels
        hieronder.
      </Alert>

      <FilterBar
        action={ADMIN_ROUTES.logs}
        search={query.search}
        searchPlaceholder="Bericht, kantoor, jobId, foutcode of betaal-id"
        isFiltered={Boolean(query.search || query.level || query.source || query.organisationId)}
        hidden={query.organisationId ? { [ADMIN_PARAMS.organisation]: query.organisationId } : {}}
        selects={[
          {
            name: ADMIN_PARAMS.level,
            label: "Niveau",
            value: query.level ?? "",
            options: [
              { value: "", label: "Elk niveau" },
              ...LOG_LEVELS.map((level) => ({
                value: level,
                label: ADMIN_LOG_LEVEL_LABELS[level],
              })),
            ],
          },
          {
            name: ADMIN_PARAMS.source,
            label: "Onderdeel",
            value: query.source ?? "",
            options: [
              { value: "", label: "Elk onderdeel" },
              ...LOG_SOURCES.map((source) => ({
                value: source,
                label: ADMIN_LOG_SOURCE_LABELS[source],
              })),
            ],
          },
        ]}
      />

      <LogList entries={result.items} empty="Geen gebeurtenissen gevonden." />

      <Pagination
        result={result}
        pathname={ADMIN_ROUTES.logs}
        params={params}
        label="gebeurtenissen"
      />
    </>
  );
}
