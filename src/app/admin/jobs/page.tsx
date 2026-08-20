import type { Metadata } from "next";
import { FilterBar, JobTable, Pagination } from "@/components/admin";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { getAdminStore } from "@/db/admin-store";
import { ADMIN_PARAMS, parseJobQuery, type AdminSearchParams } from "@/lib/admin/query";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { RENDER_ERROR_CODES, messageFor } from "@/lib/render/errors";
import { RENDER_JOB_STATUS_LABELS, RENDER_JOB_STATUS_ORDER } from "@/lib/render/status";

export const metadata: Metadata = { title: "Renders" };
export const dynamic = "force-dynamic";

/**
 * De renderjobs — in de praktijk: de mislukte renders.
 *
 * Zonder filter in de URL staat deze lijst op `failed`. Dat is geen mening over
 * wat belangrijk is maar over hoe deze pagina gebruikt wordt: wie hem opent,
 * heeft iemand aan de lijn wiens video er niet is. Wie alles wil zien, kiest
 * "Alle" in de statusfilter.
 */
export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = await searchParams;
  const query = parseJobQuery(params);
  const result = await getAdminStore().listJobs(query);

  return (
    <>
      <PageHeader
        title="Renders"
        description="Elke renderjob, met de fout erbij. Zoek op job-id, project, kantoor of foutcode."
      />

      <FilterBar
        action={ADMIN_ROUTES.jobs}
        search={query.search}
        searchPlaceholder="Job-id, projecttitel, preset of foutcode"
        isFiltered={Boolean(
          query.search || query.errorCode || query.organisationId || query.status !== "failed",
        )}
        hidden={query.organisationId ? { [ADMIN_PARAMS.organisation]: query.organisationId } : {}}
        selects={[
          {
            name: ADMIN_PARAMS.status,
            label: "Status",
            value: query.status ?? "all",
            options: [
              { value: "all", label: "Alle statussen" },
              ...RENDER_JOB_STATUS_ORDER.map((status) => ({
                value: status,
                label: RENDER_JOB_STATUS_LABELS[status],
              })),
            ],
          },
          {
            name: ADMIN_PARAMS.errorCode,
            label: "Foutcode",
            value: query.errorCode ?? "",
            options: [
              { value: "", label: "Elke foutcode" },
              ...RENDER_ERROR_CODES.map((code) => ({ value: code, label: code })),
            ],
          },
        ]}
      />

      {query.errorCode ? (
        <Alert variant="warning" className="mb-4" title={query.errorCode}>
          {messageFor(query.errorCode)}
        </Alert>
      ) : null}

      <JobTable
        rows={result.items}
        empty={
          query.status === "failed"
            ? "Geen mislukte renders. Kies een andere status om de rest te zien."
            : "Geen renders gevonden."
        }
      />

      <Pagination result={result} pathname={ADMIN_ROUTES.jobs} params={params} label="renders" />
    </>
  );
}
