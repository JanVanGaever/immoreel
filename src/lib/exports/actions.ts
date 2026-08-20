"use server";

import { revalidatePath } from "next/cache";
import { getProjectStore } from "@/db/project-store";
import { getRenderJobStore } from "@/db/render-job-store";
import { assertPermission } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { toEditorDocument } from "@/lib/editor/document";
import { findExportPreset } from "@/lib/editor/export-presets";
import { buildRenderPlan } from "@/lib/editor/render-plan";
import type { RetryState } from "@/lib/exports/action-state";
import { toRenderJobSnapshot } from "@/lib/render/status";
import { isQueueConfigured } from "@/workers/config";
import { ensureInlineRenderWorker } from "@/workers/inline";
import { enqueueRenderJob } from "@/workers/queue";
import type { ID, RenderJobSnapshot } from "@/types";

/**
 * Een mislukte export opnieuw proberen.
 *
 * Dit is geen tweede soort export: het is dezelfde opdracht als in de editor,
 * met dezelfde vingerafdruk-logica erachter (`src/workers/queue.ts`). Twee
 * gevallen, en het verschil doet ertoe:
 *
 * - **Er is niets gewijzigd sinds de fout.** Dan levert het renderplan dezelfde
 *   vingerafdruk op, dus dezelfde jobid, en wordt precies die job opnieuw
 *   ingestuurd. De kaart op de pagina blijft dezelfde kaart.
 * - **De montage is intussen aangepast.** Dan is het een ander plan, dus een
 *   nieuwe job. De kaart voor dat platform toont vanaf nu die nieuwe poging;
 *   de oude blijft in de store staan voor wie de logs leest.
 *
 * Wat er hier bewust *niet* gebeurt, is de fout wegpoetsen. De rij gaat naar
 * `queued`, maar de foutmelding blijft eraan hangen tot een worker de job
 * effectief claimt — verdwijnt ze meteen, dan is er geen spoor meer van waarom
 * er opnieuw geprobeerd wordt.
 */
export async function retryExportsAction(projectId: ID, presetIds: ID[]): Promise<RetryState> {
  const { organisation, user } = await assertPermission("project:edit");

  if (presetIds.length === 0) {
    return { status: "fout", message: "Er is niets om opnieuw te proberen." };
  }

  if (!isQueueConfigured()) {
    return {
      status: "fout",
      message: "De renderwachtrij is niet geconfigureerd. Zet REDIS_URL en start de worker.",
    };
  }

  const project = await getProjectStore().findProject(organisation.id, projectId);
  if (!project) return { status: "fout", message: "Dit project bestaat niet meer." };

  const presets = presetIds
    .map((presetId) => findExportPreset(presetId))
    .filter((preset) => preset !== null);

  if (presets.length === 0) {
    return { status: "fout", message: "Dit exportformaat bestaat niet meer." };
  }

  if (project.scenes.length === 0) {
    return { status: "fout", message: "Dit project heeft geen foto's meer om te renderen." };
  }

  const document = toEditorDocument(project);
  const store = getRenderJobStore();
  const snapshots: RenderJobSnapshot[] = [];

  // Alleen bij ontwikkelen: dan draait de worker mee in dit proces.
  ensureInlineRenderWorker();

  for (const preset of presets) {
    const { job } = await enqueueRenderJob({
      organisationId: organisation.id,
      projectId,
      presetId: preset.id,
      requestedBy: user.id,
      plan: buildRenderPlan(document, preset),
    });

    // Dezelfde job als daarnet, en die staat op `failed`. Zonder deze zet
    // blijft de kaart "Mislukt" tonen tot een worker hem oppikt — precies de
    // seconden waarin de gebruiker denkt dat zijn klik niets gedaan heeft.
    const requeued = job.status === "failed" ? await store.requeue(organisation.id, job.id) : job;

    snapshots.push(toRenderJobSnapshot(requeued ?? job));
  }

  await getProjectStore().setProjectStatus(organisation.id, projectId, "wachtrij");

  revalidatePath(ROUTES.projects);
  revalidatePath(ROUTES.project(projectId));
  revalidatePath(ROUTES.projectExports(projectId));

  return {
    status: "wachtrij",
    message:
      snapshots.length === 1
        ? `${presets[0]!.label} staat opnieuw in de wachtrij.`
        : `${snapshots.length} exports staan opnieuw in de wachtrij.`,
    snapshots,
  };
}
