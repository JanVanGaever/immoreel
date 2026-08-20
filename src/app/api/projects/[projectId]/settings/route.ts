import { handle, jsonOk, readJsonObject, requireApiSession } from "@/lib/api";
import { readProjectSettings } from "@/lib/projects/input";
import { saveProjectChanges } from "@/lib/projects/service";

/**
 * De instellingen van de video: beeldverhouding, template, huisstijl, muziek en
 * de platformen waarnaar geëxporteerd wordt.
 *
 * Dit is precies het tabblad "Video" van de editor, en het staat los van
 * `PATCH` op het project zelf omdat het een ander soort wijziging is. De titel
 * en de tijdlijn zijn het werk; dit is hoe dat werk eruitziet. Een client die
 * alleen de huisstijl van een project bijstelt, hoeft daarvoor niets te weten
 * van scènes — en kan er hier ook niet per ongeluk aankomen: `title` of
 * `scenes` meesturen levert een fout op in plaats van stilte.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handle(async () => {
    const session = await requireApiSession("project:edit");
    const { projectId } = await params;
    const settings = readProjectSettings(await readJsonObject(request));
    const project = await saveProjectChanges(session.organisation.id, projectId, settings);

    return jsonOk({
      project,
      // Wat er nu écht staat, zodat een client niet hoeft te gokken wat er van
      // zijn instellingen rechtgetrokken is.
      settings: {
        aspectRatio: project.aspectRatio,
        templateId: project.templateId ?? null,
        branding: project.branding,
        audio: project.audio,
        exportPresetIds: project.exportPresetIds,
      },
    });
  });
}
