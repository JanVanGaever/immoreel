import { randomUUID } from "node:crypto";
import { SEED_USER_IDS, days, hours, minutes, seedTime } from "@/db/seed/config";
import { seedInvoices } from "@/db/seed/billing";
import { seedProjects } from "@/db/seed/projects";
import { seedRenderJobs } from "@/db/seed/renders";
import { findExportPreset } from "@/lib/editor/export-presets";
import { describeEvent } from "@/lib/notifications/catalogue";
import type { ID, Notification, NotificationPayload } from "@/types";

/**
 * De bel van het demokantoor.
 *
 * Zoals de rest van de seed verwijst dit naar wat er al staat: de meldingen
 * worden gemaakt uit de geseede renderjobs (`renders.ts`), met dezelfde
 * catalogus die de echte meldingen bouwt. Klikken op "Video klaar voor
 * Herenhuis Leiestraat" opent dus de downloadpagina waar die video ook echt
 * staat — en niet een pand dat alleen in deze lijst bestaat.
 *
 * De renders van de seed zijn door de editor gevraagd, dus in háár bel staan
 * ze — precies zoals de echte regel het wil (`lib/notifications/recipients.ts`).
 * De eigenaar krijgt wat bij hem hoort: de mislukte incasso uit de
 * betaalgeschiedenis, al gelezen, want de herkansing erna is gelukt.
 *
 * Zo laat de demo allebei de kanten zien: twee ongelezen renders bij Sofie
 * (waaronder een mislukte export, de regel waar een bel om bestaat) en een
 * gelezen facturatiemelding bij de eigenaar.
 */
export function seedNotifications(): Map<ID, Notification[]> {
  const byUser = new Map<ID, Notification[]>();
  const jobs = seedRenderJobs();
  const projects = seedProjects();

  const titleOf = (projectId: ID): string =>
    projects.find((project) => project.id === projectId)?.title ?? "je project";

  const done = jobs.filter((job) => job.status === "done");
  const failed = jobs.find((job) => job.status === "failed");

  // Nieuwste eerst, net als wat de store teruggeeft: de mislukte export is het
  // recentst, want dat is de regel die bovenaan hoort te staan.
  const entries: { payload: NotificationPayload; userId: ID; ageInMs: number; read: boolean }[] = [];

  if (failed?.error) {
    entries.push({
      userId: failed.requestedBy,
      ageInMs: -minutes(35),
      read: false,
      payload: {
        topic: "render-mislukt",
        projectId: failed.projectId,
        projectTitle: titleOf(failed.projectId),
        jobId: failed.id,
        presetLabel: findExportPreset(failed.presetId)?.label ?? "De export",
        reason: failed.error.message,
        code: failed.error.code,
        retryable: failed.error.retryable,
      },
    });
  }

  for (const [index, job] of done.entries()) {
    entries.push({
      userId: job.requestedBy,
      ageInMs: -hours(index === 0 ? 4 : 27),
      // De oudste is al gelezen; de recentste nog niet.
      read: index > 0,
      payload: {
        topic: "render-klaar",
        projectId: job.projectId,
        projectTitle: titleOf(job.projectId),
        jobId: job.id,
        presetLabel: findExportPreset(job.presetId)?.label ?? "De export",
      },
    });
  }

  const mislukteIncasso = seedInvoices().find((invoice) => invoice.status === "mislukt");

  if (mislukteIncasso) {
    entries.push({
      userId: SEED_USER_IDS.owner,
      ageInMs: -days(92),
      read: true,
      payload: {
        topic: "betaling-mislukt",
        invoiceId: mislukteIncasso.id,
        amountInCents: mislukteIncasso.amountInCents,
        reason: mislukteIncasso.failureReason ?? null,
      },
    });
  }

  for (const entry of entries) {
    const content = describeEvent(entry.payload);
    const createdAt = seedTime(entry.ageInMs);

    const notification: Notification = {
      id: randomUUID(),
      organisationId: jobs[0]?.organisationId ?? "org_demo",
      userId: entry.userId,
      ...content,
      readAt: entry.read ? seedTime(entry.ageInMs + minutes(20)) : null,
      createdAt,
      updatedAt: createdAt,
    };

    byUser.set(entry.userId, [...(byUser.get(entry.userId) ?? []), notification]);
  }

  return byUser;
}
