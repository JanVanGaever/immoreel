import type { Metadata } from "next";
import Link from "next/link";
import {
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
import { ADMIN_PARAMS, parseBillingQuery, type AdminSearchParams } from "@/lib/admin/query";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { PLAN_LIST } from "@/lib/billing/plans";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/billing/status";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AdminBillingRow, SubscriptionStatus } from "@/types";

export const metadata: Metadata = { title: "Facturatie" };
export const dynamic = "force-dynamic";

/**
 * De facturatiestand per kantoor.
 *
 * Wat aandacht vraagt staat bovenaan: eerst mislukte incasso's, dan
 * afrekeningen die nog bij Mollie hangen. De rest van de lijst bestaat om in te
 * zoeken — op kantoornaam, maar ook op `cst_`, `sub_` en `tr_`, want dat zijn
 * de ids waarmee een vraag van of aan Mollie binnenkomt.
 */
export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = await searchParams;
  const query = parseBillingQuery(params);
  const result = await getAdminStore().listBilling(query);

  const columns: DataTableColumn<AdminBillingRow>[] = [
    {
      key: "organisation",
      header: "Kantoor",
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.organisation(row.organisation.id)}
          className="font-medium underline-offset-2 hover:underline"
        >
          {row.organisation.name}
        </Link>
      ),
    },
    { key: "plan", header: "Plan", cell: (row) => <PlanBadge subscription={row.subscription} /> },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <div className="space-y-1">
          <SubscriptionBadge subscription={row.subscription} />
          {row.subscription?.cancelAtPeriodEnd ? (
            <p className="text-xs text-fg-subtle">Zegt op einde periode op</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "price",
      header: "Per maand",
      align: "right",
      cell: (row) =>
        row.monthlyPriceInCents === null ? (
          <span className="text-fg-subtle">—</span>
        ) : (
          <span className="text-sm text-fg-muted" title="Exclusief btw">
            {formatCurrency(row.monthlyPriceInCents)}
          </span>
        ),
    },
    {
      key: "period",
      header: "Loopt tot",
      align: "right",
      cell: (row) =>
        row.subscription ? (
          <span className="text-sm text-fg-muted">
            {formatDate(row.subscription.currentPeriodEnd)}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: "invoices",
      header: "Betalingen",
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-sm text-fg-muted">{row.invoiceCount}</span>
          {row.failedInvoiceCount > 0 ? (
            <Badge variant="danger" size="sm">
              {row.failedInvoiceCount} mislukt
            </Badge>
          ) : null}
          {row.openCheckout ? (
            <Badge variant="warning" size="sm" title={row.openCheckout.molliePaymentId}>
              Afrekening loopt
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "mandate",
      header: "Mandaat",
      cell: (row) =>
        row.mollie.mandateId ? (
          <Identifier value={row.mollie.mandateId} />
        ) : (
          <Badge
            variant="neutral"
            size="sm"
            title="Zonder mandaat kan er niets automatisch geïnd worden."
          >
            Geen
          </Badge>
        ),
    },
    {
      key: "customer",
      header: "Mollie-klant",
      cell: (row) =>
        row.mollie.customerId ? (
          <Identifier value={row.mollie.customerId} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Facturatie"
        description="Abonnementen per kantoor. Mislukte incasso's en lopende afrekeningen staan bovenaan."
      />

      <FilterBar
        action={ADMIN_ROUTES.billing}
        search={query.search}
        searchPlaceholder="Kantoor, org_..., cst_..., sub_... of factuurnummer"
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
            label: "Status",
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
        getKey={(row) => row.organisation.id}
        empty="Geen kantoren gevonden."
      />

      <Pagination
        result={result}
        pathname={ADMIN_ROUTES.billing}
        params={params}
        label="kantoren"
      />
    </>
  );
}
