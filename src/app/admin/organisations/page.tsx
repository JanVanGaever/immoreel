import type { Metadata } from "next";
import Link from "next/link";
import {
  CellStack,
  DataTable,
  FilterBar,
  Identifier,
  Pagination,
  PlanBadge,
  SubscriptionBadge,
} from "@/components/admin";
import type { DataTableColumn } from "@/components/admin";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getAdminStore } from "@/db/admin-store";
import { ADMIN_PARAMS, parseOrganisationQuery, type AdminSearchParams } from "@/lib/admin/query";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { PLAN_LIST } from "@/lib/billing/plans";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/billing/status";
import { formatDate, formatNumber } from "@/lib/format";
import type { AdminOrganisationRow, SubscriptionStatus } from "@/types";

export const metadata: Metadata = { title: "Kantoren" };
export const dynamic = "force-dynamic";

/**
 * De kantoren, met de kapotte bovenaan.
 *
 * De sortering is bewust niet alfabetisch en niet op datum: een lijst die op
 * naam sorteert, is een lijst waarin je iets moet weten om iets te vinden.
 * Kantoren met mislukte renders eerst betekent dat het scherm zelf al de eerste
 * helft van het werk doet.
 */
export default async function AdminOrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = await searchParams;
  const query = parseOrganisationQuery(params);
  const result = await getAdminStore().listOrganisations(query);

  const columns: DataTableColumn<AdminOrganisationRow>[] = [
    {
      key: "organisation",
      header: "Kantoor",
      cell: (row) => (
        <Link href={ADMIN_ROUTES.organisation(row.id)} className="block hover:underline">
          <CellStack title={row.name} subtitle={row.slug} />
        </Link>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      cell: (row) => <PlanBadge subscription={row.subscription} />,
    },
    {
      key: "status",
      header: "Abonnement",
      cell: (row) => <SubscriptionBadge subscription={row.subscription} />,
    },
    {
      key: "members",
      header: "Leden",
      align: "right",
      cell: (row) => formatNumber(row.memberCount),
    },
    {
      key: "projects",
      header: "Projecten",
      align: "right",
      cell: (row) => formatNumber(row.projectCount),
    },
    {
      key: "failed",
      header: "Mislukt",
      align: "right",
      cell: (row) =>
        row.failedJobCount > 0 ? (
          <Link href={`${ADMIN_ROUTES.jobs}?${ADMIN_PARAMS.organisation}=${row.id}`}>
            <Badge variant="danger" size="sm">
              {formatNumber(row.failedJobCount)}
            </Badge>
          </Link>
        ) : (
          <span className="text-fg-subtle">0</span>
        ),
    },
    {
      key: "created",
      header: "Klant sinds",
      align: "right",
      cell: (row) => <span className="text-sm text-fg-muted">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "id",
      header: "Id",
      cell: (row) => <Identifier value={row.id} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Kantoren"
        description="Alle organisaties. Kantoren met mislukte renders staan bovenaan."
      />

      <FilterBar
        action={ADMIN_ROUTES.organisations}
        search={query.search}
        searchPlaceholder="Naam, slug, btw-nummer of org_..."
        isFiltered={Boolean(query.search || query.planId || query.status)}
        selects={[
          {
            name: ADMIN_PARAMS.plan,
            label: "Plan",
            value: query.planId ?? "",
            options: [
              { value: "", label: "Alle plannen" },
              ...PLAN_LIST.map((plan) => ({ value: plan.id, label: plan.name })),
            ],
          },
          {
            name: ADMIN_PARAMS.status,
            label: "Abonnement",
            value: query.status ?? "",
            options: [
              { value: "", label: "Elke status" },
              ...(Object.keys(SUBSCRIPTION_STATUS_LABELS) as SubscriptionStatus[]).map(
                (status) => ({ value: status, label: SUBSCRIPTION_STATUS_LABELS[status] }),
              ),
            ],
          },
        ]}
      />

      <DataTable
        rows={result.items}
        columns={columns}
        getKey={(row) => row.id}
        empty="Geen kantoren gevonden."
      />

      <Pagination
        result={result}
        pathname={ADMIN_ROUTES.organisations}
        params={params}
        label="kantoren"
      />
    </>
  );
}
