import type { Metadata } from "next";
import Link from "next/link";
import { Building2, TriangleAlert, Users, Video } from "lucide-react";
import { LogList } from "@/components/admin";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { getAdminStore } from "@/db/admin-store";
import { staffEmails, staffSource } from "@/lib/admin/access";
import { ADMIN_PARAMS } from "@/lib/admin/query";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/billing/status";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_ORDER } from "@/lib/project-status";
import { messageFor } from "@/lib/render/errors";
import { RENDER_JOB_STATUS_LABELS } from "@/lib/render/status";
import type { SubscriptionStatus } from "@/types";

export const metadata: Metadata = { title: "Overzicht" };

/** Verse cijfers of geen cijfers: een supportpaneel dat een minuut oud is, liegt. */
export const dynamic = "force-dynamic";

/**
 * Het overzicht: de eerste vraag van elke supportdag, in cijfers.
 *
 * Niet "hoe gaat het met het bedrijf" — daar is het dashboard van de klant en
 * straks een rapportage voor. Wel: draait alles, en zo niet, waar begint het
 * zoeken? Vandaar dat elk getal hieronder doorklikt naar de lijst waar het uit
 * komt, met de filter al gezet.
 */
export default async function AdminOverviewPage() {
  const summary = await getAdminStore().getSummary();
  const staffCount = staffEmails().length;

  return (
    <>
      <PageHeader
        title="Overzicht"
        description="De stand van zaken over alle kantoren heen. Elk cijfer klikt door naar de lijst erachter."
      />

      <Alert variant="info" className="mb-6" title="Dit paneel leest alleen.">
        Er zit geen knop in die iets wijzigt: geen render opnieuw starten, geen abonnement
        aanpassen, geen account bewerken. Wat je hier ziet is de stand zoals ze opgeslagen staat.
        Toegang loopt via {staffSource() === "env" ? "ADMIN_EMAILS" : "de ontwikkelstand"} —{" "}
        {staffCount === 1 ? "één intern adres" : `${formatNumber(staffCount)} interne adressen`}.
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={ADMIN_ROUTES.organisations} className="rounded-xl focus-visible:outline-none">
          <Stat
            label="Kantoren"
            value={formatNumber(summary.organisationCount)}
            hint={`${formatNumber(summary.withoutSubscription)} zonder abonnementsrij`}
            icon={Building2}
          />
        </Link>
        <Link href={ADMIN_ROUTES.users} className="rounded-xl focus-visible:outline-none">
          <Stat label="Gebruikers" value={formatNumber(summary.userCount)} icon={Users} />
        </Link>
        <Link href={ADMIN_ROUTES.projects} className="rounded-xl focus-visible:outline-none">
          <Stat
            label="Projecten"
            value={formatNumber(summary.projectCount)}
            hint={`${formatNumber(summary.projectsByStatus.mislukt)} met een mislukte render`}
            icon={Video}
          />
        </Link>
        <Link href={ADMIN_ROUTES.jobs} className="rounded-xl focus-visible:outline-none">
          <Stat
            label="Mislukte renders"
            value={formatNumber(summary.jobs.failed)}
            hint={`${formatNumber(summary.jobs.failedLastDay)} in de laatste 24 uur`}
            icon={TriangleAlert}
          />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Renders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(["queued", "processing", "failed", "done"] as const).map((status) => (
              <Link
                key={status}
                href={`${ADMIN_ROUTES.jobs}?${ADMIN_PARAMS.status}=${status}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-subtle"
              >
                <span className="text-fg-muted">{RENDER_JOB_STATUS_LABELS[status]}</span>
                <span className="font-medium tabular-nums">
                  {formatNumber(
                    status === "queued"
                      ? summary.jobs.queued
                      : status === "processing"
                        ? summary.jobs.running
                        : status === "failed"
                          ? summary.jobs.failed
                          : summary.jobs.done,
                  )}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projecten per status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PROJECT_STATUS_ORDER.map((status) => (
              <Link
                key={status}
                href={`${ADMIN_ROUTES.projects}?${ADMIN_PARAMS.status}=${status}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-subtle"
              >
                <span className="text-fg-muted">{PROJECT_STATUS_LABELS[status]}</span>
                <span className="font-medium tabular-nums">
                  {formatNumber(summary.projectsByStatus[status])}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abonnementen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(Object.keys(SUBSCRIPTION_STATUS_LABELS) as SubscriptionStatus[]).map((status) => (
              <Link
                key={status}
                href={`${ADMIN_ROUTES.billing}?${ADMIN_PARAMS.status}=${status}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-subtle"
              >
                <span className="text-fg-muted">{SUBSCRIPTION_STATUS_LABELS[status]}</span>
                <span className="font-medium tabular-nums">
                  {formatNumber(summary.subscriptions[status])}
                </span>
              </Link>
            ))}
            <div className="flex items-center justify-between border-t border-border px-2 pt-3 text-sm">
              <span className="text-fg-muted">Mislukte betalingen</span>
              <span className="font-medium tabular-nums text-danger">
                {formatNumber(summary.failedInvoiceCount)}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 text-sm">
              <span className="text-fg-muted">Lopende afrekeningen</span>
              <span className="font-medium tabular-nums">
                {formatNumber(summary.openCheckoutCount)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {summary.errorCodes.length > 0 ? (
        <section className="mt-8">
          <SectionHeader
            title="Foutcodes"
            description="Waar de mislukte renders op stukliepen. Klik door voor de jobs achter een code."
          />
          <div className="flex flex-wrap gap-2">
            {summary.errorCodes.map((entry) => (
              <Link
                key={entry.code}
                href={`${ADMIN_ROUTES.jobs}?${ADMIN_PARAMS.errorCode}=${entry.code}`}
                title={messageFor(entry.code)}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-border-strong"
              >
                <code className="font-mono text-xs text-fg-muted">{entry.code}</code>
                <Badge variant="danger" size="sm">
                  {formatNumber(entry.count)}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <SectionHeader
          title="Laatste mislukte renders"
          description="Waar een gesprek met support meestal over gaat."
          actions={
            <Link
              href={ADMIN_ROUTES.jobs}
              className="text-sm text-fg-muted underline-offset-2 hover:underline"
            >
              Alle renders
            </Link>
          }
        />
        {summary.recentFailures.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center text-sm text-fg-muted">
            Geen mislukte renders. Dat is de bedoeling.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {summary.recentFailures.map((job) => (
              <li key={job.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={ADMIN_ROUTES.job(job.id)}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {job.project?.title ?? "Project bestaat niet meer"}
                  </Link>
                  <span className="text-xs text-fg-subtle">
                    {formatRelativeTime(job.finishedAt ?? job.updatedAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-fg-muted">
                  {job.error?.message ?? "Zonder foutmelding afgebroken."}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-4 font-mono text-xs text-fg-subtle">
                  <span>code: {job.error?.code ?? "—"}</span>
                  <span>preset: {job.presetId}</span>
                  <span>{job.organisation?.name ?? "kantoor onbekend"}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <SectionHeader
          title="Laatste gebeurtenissen"
          description="Afgeleid uit de tijdstempels die de app bewaart — niet uit een logdienst."
          actions={
            <Link
              href={ADMIN_ROUTES.logs}
              className="text-sm text-fg-muted underline-offset-2 hover:underline"
            >
              Alle logs
            </Link>
          }
        />
        <LogList entries={summary.recentEvents} />
      </section>
    </>
  );
}
