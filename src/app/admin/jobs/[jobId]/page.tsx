import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DetailList, LogList, RawRecord } from "@/components/admin";
import type { DetailItem } from "@/components/admin";
import { ExportStatusBadge } from "@/components/exports/export-status-badge";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminStore } from "@/db/admin-store";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { formatBytes, formatDateTime, formatDuration, formatSeconds } from "@/lib/format";
import { RENDER_STAGE_LABELS } from "@/lib/render/status";

export const metadata: Metadata = { title: "Render" };
export const dynamic = "force-dynamic";

/**
 * Eén renderjob, uitgeklapt.
 *
 * Dit is het scherm waarvoor het paneel bestaat. Alles wat support nodig heeft
 * om te antwoorden zonder een ontwikkelaar te storen staat erop: wat er
 * misging in het Nederlands, wat er in de logs staat, op welke stap het gebeurde,
 * of nog eens proberen zin heeft, en de ids waarmee je de rest terugvindt.
 *
 * Wat er níét op staat, is een knop om het opnieuw te proberen. Dat is een
 * bewuste grens: het paneel leest. Een render herstarten hoort thuis in de app
 * van de klant zelf, waar het al kan en waar het al gelogd wordt.
 */
export default async function AdminJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const detail = await getAdminStore().findJob(decodeURIComponent(jobId));
  if (!detail) notFound();

  const { job } = detail;

  const timing: DetailItem[] = [
    { label: "In wachtrij", value: formatDateTime(job.queuedAt) },
    { label: "Gestart", value: job.startedAt ? formatDateTime(job.startedAt) : null },
    { label: "Afgerond", value: job.finishedAt ? formatDateTime(job.finishedAt) : null },
    {
      label: "Wachttijd",
      value: job.startedAt
        ? formatDuration(
            (new Date(job.startedAt).getTime() - new Date(job.queuedAt).getTime()) / 1000,
          )
        : null,
    },
    {
      label: "Rendertijd",
      value:
        job.startedAt && job.finishedAt
          ? formatDuration(
              (new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000,
            )
          : null,
    },
    { label: "Poging", value: job.attempt > 0 ? String(job.attempt) : null },
  ];

  const identifiers: DetailItem[] = [
    { label: "Job-id", value: job.id, mono: true },
    { label: "Preset", value: `${job.presetLabel} (${job.presetId})` },
    {
      label: "Vingerafdruk",
      value: detail.fingerprint,
      mono: true,
    },
    {
      label: "Lease",
      value: detail.leaseId ?? "Geen worker houdt deze job vast",
      mono: Boolean(detail.leaseId),
    },
    { label: "Opslagsleutel", value: detail.outputKey, mono: true },
    { label: "Aangevraagd door", value: job.requestedBy?.name ?? null },
  ];

  const output: DetailItem[] = [
    { label: "Bestandsgrootte", value: job.sizeInBytes ? formatBytes(job.sizeInBytes) : null },
    {
      label: "Lengte",
      value: job.durationInSeconds ? formatSeconds(job.durationInSeconds) : null,
    },
    { label: "Video-URL", value: detail.outputUrl, mono: true },
    { label: "Poster-URL", value: detail.posterUrl, mono: true },
  ];

  return (
    <>
      <PageHeader
        title={job.project?.title ?? "Render"}
        description={`Renderjob voor ${job.presetLabel}${job.organisation ? ` · ${job.organisation.name}` : ""}`}
        actions={
          <Link href={ADMIN_ROUTES.jobs} className={buttonClasses("secondary", "md")}>
            <ArrowLeft />
            Renders
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ExportStatusBadge status={job.status} />
        {job.stage ? <Badge variant="neutral">{RENDER_STAGE_LABELS[job.stage]}</Badge> : null}
        <Badge variant="neutral">{job.progress}%</Badge>
        {job.project ? (
          <Link
            href={ADMIN_ROUTES.project(job.project.id)}
            className="text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            Naar het project
          </Link>
        ) : null}
        {job.organisation ? (
          <Link
            href={ADMIN_ROUTES.organisation(job.organisation.id)}
            className="text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            Naar het kantoor
          </Link>
        ) : null}
      </div>

      {job.error ? (
        <Card className="mb-6 border-danger/30">
          <CardHeader>
            <CardTitle>De fout</CardTitle>
            <Badge variant={job.error.retryable ? "warning" : "danger"} size="sm">
              {job.error.retryable ? "Opnieuw proberen kan helpen" : "Opnieuw proberen helpt niet"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="danger" title={job.error.message}>
              Dit is de zin die de klant te zien kreeg.
            </Alert>

            <DetailList
              columns={3}
              items={[
                { label: "Code", value: job.error.code, mono: true },
                {
                  label: "Stap",
                  value: job.error.stage ? RENDER_STAGE_LABELS[job.error.stage] : null,
                },
                { label: "Tijdstip", value: formatDateTime(job.error.at) },
              ]}
            />

            <div>
              <p className="mb-1.5 text-xs tracking-wide text-fg-subtle uppercase">
                Technisch detail
              </p>
              {job.error.detail ? (
                <pre className="max-h-64 overflow-auto rounded-lg bg-surface-inset p-4 font-mono text-xs break-words whitespace-pre-wrap text-fg-muted select-all">
                  {job.error.detail}
                </pre>
              ) : (
                <p className="text-sm text-fg-subtle">
                  Geen detail vastgelegd. Zoek in de workerlogs op het job-id hieronder.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tijdlijn</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList items={timing} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultaat</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList items={output} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Kenmerken</CardTitle>
          <p className="text-xs text-fg-subtle">Hiermee zoek je in de workerlogs.</p>
        </CardHeader>
        <CardContent>
          <DetailList items={identifiers} />
        </CardContent>
      </Card>

      <section className="mt-8">
        <SectionHeader title="Wat er gebeurde" />
        <LogList entries={detail.timeline} showOrganisation={false} />
      </section>

      <div className="mt-4">
        <RawRecord value={detail.raw} title="Ruwe renderjob" />
      </div>
    </>
  );
}
