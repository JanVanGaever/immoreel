import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  DataTable,
  DetailList,
  Identifier,
  JobTable,
  LogList,
  PlanBadge,
  ProjectTable,
  SubscriptionBadge,
} from "@/components/admin";
import type { DataTableColumn } from "@/components/admin";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { RoleBadge } from "@/components/team/role-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { getAdminStore } from "@/db/admin-store";
import { ADMIN_PARAMS } from "@/lib/admin/query";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { periodSentence } from "@/lib/billing/status";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { AdminInvoiceRow, AdminUserRow } from "@/types";

export const metadata: Metadata = { title: "Kantoor" };
export const dynamic = "force-dynamic";

/** Hoeveel renders en projecten er per kantoor getoond worden voor de lijst te lang wordt. */
const PREVIEW_LIMIT = 10;

const INVOICE_VARIANTS = {
  betaald: "success",
  open: "warning",
  mislukt: "danger",
  terugbetaald: "neutral",
} as const;

/**
 * Eén kantoor, met alles eraan.
 *
 * Dit is het scherm waar een supportgesprek begint zodra de naam van het
 * kantoor valt: wie werkt er, wat hebben ze gemaakt, wat ging er stuk, en staat
 * de facturatie recht. Alles wat verder gaat dan een overzicht zit achter een
 * link naar de volledige lijst — een detailpagina die alles toont, toont
 * uiteindelijk niets.
 */
export default async function AdminOrganisationPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  const detail = await getAdminStore().findOrganisation(organisationId);
  if (!detail) notFound();

  const { organisation, billing } = detail;
  const subscription = billing.subscription;

  const memberColumns: DataTableColumn<AdminUserRow>[] = [
    {
      key: "name",
      header: "Naam",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="truncate text-xs text-fg-subtle">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Rol",
      cell: (row) => (row.role ? <RoleBadge role={row.role} /> : "—"),
    },
    {
      key: "verified",
      header: "E-mail",
      cell: (row) =>
        row.emailVerifiedAt ? (
          <span className="text-sm text-fg-muted">Bevestigd</span>
        ) : (
          <Badge variant="warning" size="sm">
            Niet bevestigd
          </Badge>
        ),
    },
    {
      key: "password",
      header: "Wachtwoord",
      cell: (row) => (
        <span className="text-sm text-fg-muted">
          {row.hasPassword ? "Ingesteld" : "Alleen magic link"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Sinds",
      align: "right",
      cell: (row) => <span className="text-sm text-fg-muted">{formatDate(row.createdAt)}</span>,
    },
    { key: "id", header: "Id", cell: (row) => <Identifier value={row.id} /> },
  ];

  const invoiceColumns: DataTableColumn<AdminInvoiceRow>[] = [
    { key: "number", header: "Nummer", cell: (row) => <span className="font-medium">{row.number}</span> },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={INVOICE_VARIANTS[row.status]} size="sm" dot>
          {row.status}
        </Badge>
      ),
    },
    { key: "description", header: "Omschrijving", cell: (row) => row.description },
    {
      key: "amount",
      header: "Bedrag",
      align: "right",
      cell: (row) => formatCurrency(row.amountInCents, row.currency),
    },
    {
      key: "date",
      header: "Betaald",
      align: "right",
      cell: (row) => (
        <span className="text-sm text-fg-muted">
          {row.paidAt ? formatDate(row.paidAt) : formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "failure",
      header: "Reden",
      cell: (row) => row.failureReason ?? <span className="text-fg-subtle">—</span>,
    },
    {
      key: "payment",
      header: "Mollie",
      cell: (row) =>
        row.molliePaymentId ? (
          <Identifier value={row.molliePaymentId} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={organisation.name}
        description={`Kantoor sinds ${formatDate(organisation.createdAt)} · ${organisation.slug}`}
        actions={
          <Link href={ADMIN_ROUTES.organisations} className={buttonClasses("secondary", "md")}>
            <ArrowLeft />
            Kantoren
          </Link>
        }
      />

      {organisation.failedJobCount > 0 ? (
        <Alert
          variant="danger"
          className="mb-6"
          title={`${formatNumber(organisation.failedJobCount)} mislukte ${organisation.failedJobCount === 1 ? "render" : "renders"}`}
        >
          <Link
            href={`${ADMIN_ROUTES.jobs}?${ADMIN_PARAMS.organisation}=${organisation.id}`}
            className="underline underline-offset-2"
          >
            Bekijk ze allemaal
          </Link>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leden" value={formatNumber(organisation.memberCount)} />
        <Stat label="Projecten" value={formatNumber(organisation.projectCount)} />
        <Stat label="Renders" value={formatNumber(detail.jobs.length)} />
        <Stat
          label="Mislukte renders"
          value={formatNumber(organisation.failedJobCount)}
          hint={organisation.failedJobCount > 0 ? "Vraagt aandacht" : "Alles goed"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kantoor</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: "Organisatie-id", value: organisation.id, mono: true },
                { label: "Slug", value: organisation.slug },
                { label: "Btw-nummer", value: organisation.vatNumber },
                { label: "Aangemaakt", value: formatDateTime(organisation.createdAt) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abonnement</CardTitle>
            <SubscriptionBadge subscription={subscription} />
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription ? (
              <p className="text-sm text-fg-muted">{periodSentence(subscription)}</p>
            ) : (
              <p className="text-sm text-fg-muted">
                Nog geen abonnementsrij. Die ontstaat pas wanneer iemand van dit kantoor de
                facturatiepagina opent; tot dan gedraagt de app zich alsof de proefperiode loopt.
              </p>
            )}

            <DetailList
              items={[
                { label: "Plan", value: <PlanBadge subscription={subscription} /> },
                {
                  label: "Per maand",
                  value:
                    billing.monthlyPriceInCents === null
                      ? null
                      : `${formatCurrency(billing.monthlyPriceInCents)} excl. btw`,
                },
                {
                  label: "Periode",
                  value: subscription
                    ? `${formatDate(subscription.currentPeriodStart)} – ${formatDate(subscription.currentPeriodEnd)}`
                    : null,
                },
                { label: "Betaalmethode", value: subscription?.paymentMethod ?? null },
                { label: "Mollie-klant", value: billing.mollie.customerId, mono: true },
                { label: "Mollie-abonnement", value: billing.mollie.subscriptionId, mono: true },
                { label: "Mandaat", value: billing.mollie.mandateId, mono: true },
                {
                  label: "Lopende afrekening",
                  value: billing.openCheckout
                    ? `${billing.openCheckout.molliePaymentId} · sinds ${formatDateTime(billing.openCheckout.startedAt)}`
                    : null,
                  mono: Boolean(billing.openCheckout),
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <SectionHeader
          title="Leden"
          description="Wie hier staat, kan inloggen. Wie geen lidmaatschap meer heeft, komt nergens binnen."
        />
        <DataTable
          rows={detail.members}
          columns={memberColumns}
          getKey={(row) => row.id}
          empty="Dit kantoor heeft geen leden meer."
        />
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Projecten"
          description={`${formatNumber(detail.projects.length)} in totaal.`}
          actions={
            detail.projects.length > PREVIEW_LIMIT ? (
              <Link
                href={`${ADMIN_ROUTES.projects}?${ADMIN_PARAMS.organisation}=${organisation.id}`}
                className="text-sm text-fg-muted underline-offset-2 hover:underline"
              >
                Alle projecten
              </Link>
            ) : null
          }
        />
        <ProjectTable
          rows={detail.projects.slice(0, PREVIEW_LIMIT)}
          showOrganisation={false}
          empty="Dit kantoor heeft nog geen projecten."
        />
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Renders"
          description={`${formatNumber(detail.jobs.length)} in totaal, nieuwste eerst.`}
          actions={
            detail.jobs.length > PREVIEW_LIMIT ? (
              <Link
                href={`${ADMIN_ROUTES.jobs}?${ADMIN_PARAMS.organisation}=${organisation.id}&${ADMIN_PARAMS.status}=all`}
                className="text-sm text-fg-muted underline-offset-2 hover:underline"
              >
                Alle renders
              </Link>
            ) : null
          }
        />
        <JobTable
          rows={detail.jobs.slice(0, PREVIEW_LIMIT)}
          showOrganisation={false}
          empty="Dit kantoor heeft nog niets geëxporteerd."
        />
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Betalingen"
          description={
            billing.failedInvoiceCount > 0
              ? `${formatNumber(billing.failedInvoiceCount)} mislukt.`
              : "Alles betaald."
          }
        />
        <DataTable
          rows={billing.invoices}
          columns={invoiceColumns}
          getKey={(row) => row.id}
          empty="Nog geen betalingen."
        />
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Wat er gebeurde"
          description="Afgeleid uit de tijdstempels van dit kantoor."
          actions={
            <Link
              href={`${ADMIN_ROUTES.logs}?${ADMIN_PARAMS.organisation}=${organisation.id}`}
              className="text-sm text-fg-muted underline-offset-2 hover:underline"
            >
              In de logs
            </Link>
          }
        />
        <LogList entries={detail.timeline.slice(0, 20)} showOrganisation={false} />
      </section>
    </>
  );
}
