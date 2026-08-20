import type { Metadata } from "next";
import { FilterBar, Pagination, ProjectTable } from "@/components/admin";
import { PageHeader } from "@/components/layout/page-header";
import { getAdminStore } from "@/db/admin-store";
import { ADMIN_PARAMS, parseProjectQuery, type AdminSearchParams } from "@/lib/admin/query";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_ORDER } from "@/lib/project-status";

export const metadata: Metadata = { title: "Projecten" };
export const dynamic = "force-dynamic";

/** Alle videoprojecten, over alle kantoren heen. */
export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = await searchParams;
  const query = parseProjectQuery(params);
  const result = await getAdminStore().listProjects(query);

  return (
    <>
      <PageHeader
        title="Projecten"
        description="Zoek op titel, project-id of kantoornaam. De statusfilter volgt de statussen uit de app."
      />

      <FilterBar
        action={ADMIN_ROUTES.projects}
        search={query.search}
        searchPlaceholder="Titel, prj_... of kantoornaam"
        isFiltered={Boolean(query.search || query.status || query.organisationId)}
        hidden={query.organisationId ? { [ADMIN_PARAMS.organisation]: query.organisationId } : {}}
        selects={[
          {
            name: ADMIN_PARAMS.status,
            label: "Status",
            value: query.status ?? "",
            options: [
              { value: "", label: "Elke status" },
              ...PROJECT_STATUS_ORDER.map((status) => ({
                value: status,
                label: PROJECT_STATUS_LABELS[status],
              })),
            ],
          },
        ]}
      />

      <ProjectTable
        rows={result.items}
        empty="Geen projecten gevonden. Een project ontstaat pas wanneer iemand de wizard afrondt."
      />

      <Pagination
        result={result}
        pathname={ADMIN_ROUTES.projects}
        params={params}
        label="projecten"
      />
    </>
  );
}
