import { getProjectAssetStore } from "@/db/project-asset-store";
import { conflict, invalidInput } from "@/lib/api/errors";
import { templateStyle } from "@/lib/editor/templates";
import { loadOwnProject, saveProjectChanges } from "@/lib/projects/service";
import type { SceneInput } from "@/lib/projects/patch";
import { getUploadStorage } from "@/lib/uploads/storage";
import { partitionFiles, PHOTO_UPLOAD_CONSTRAINTS } from "@/lib/uploads/validation";
import { MAX_PHOTOS } from "@/lib/new-project/validation";
import { secondsPerPhotoFor } from "@/lib/new-project/draft";
import type { ID, ProjectAsset, Scene, UploadRejection, VideoProject } from "@/types";

/**
 * De foto's van een project: erin, op volgorde, en weer eruit te lezen.
 *
 * Eén regel loopt door dit hele bestand: **de volgorde van de rij is de
 * volgorde**. Dat is dezelfde afspraak als in de uploadlijst in de browser
 * (zie `src/types/upload.ts`), en ze bespaart het soort bug waarbij twee foto's
 * allebei op plek 3 staan omdat een client een `position` meestuurde die hij
 * zelf had uitgerekend.
 *
 * Assets en scènes zijn twee dingen. Een asset is een bestand in de opslag; een
 * scène is een blok in de tijdlijn dat naar zo'n bestand wijst. Ze lopen hier
 * samen op — een nieuwe foto krijgt een scène achteraan, een herschikking
 * verplaatst de bijbehorende scènes mee — maar ze blijven apart, omdat een
 * tijdlijn dingen mag doen die een uploadlijst niet kan: dezelfde foto twee
 * keer gebruiken, of eentje overslaan.
 */

export type UploadResult = {
  /** De foto's die erdoor kwamen, in de volgorde waarin ze binnenkwamen. */
  assets: ProjectAsset[];
  /** En wat er niet in mocht, met de reden erbij. */
  rejected: UploadRejection[];
  project: VideoProject;
};

export async function listProjectAssets(
  organisationId: ID,
  projectId: ID,
): Promise<ProjectAsset[]> {
  // Het project opzoeken is meteen de controle of het van dit kantoor is.
  await loadOwnProject(organisationId, projectId);

  return getProjectAssetStore().listForProject(organisationId, projectId);
}

/**
 * Foto's uploaden en er scènes van maken.
 *
 * De volgorde van de stappen doet ertoe. Eerst de rij in de store (die geeft
 * het id, en daarmee de sleutel in de opslag), dan pas de bytes. Gaat het
 * wegschrijven mis, dan wordt de rij weer weggehaald: een asset zonder bestand
 * is een render die straks afbreekt op een foto die er nooit was.
 */
export async function uploadProjectAssets(input: {
  organisationId: ID;
  userId: ID;
  projectId: ID;
  files: File[];
}): Promise<UploadResult> {
  const { organisationId, projectId, userId } = input;

  if (input.files.length === 0) {
    throw invalidInput("Er zat geen enkel bestand in dit verzoek.");
  }

  const project = await loadOwnProject(organisationId, projectId);
  const store = getProjectAssetStore();
  const existing = await store.listForProject(organisationId, projectId);

  // Dezelfde grens als in de uploadzone, en om dezelfde reden: boven de veertig
  // foto's is een pandvideo geen pandvideo meer.
  const room = MAX_PHOTOS - existing.length;
  const { accepted, rejected } = partitionFiles(input.files, PHOTO_UPLOAD_CONSTRAINTS, room);

  if (accepted.length === 0) {
    throw invalidInput(
      "Geen van deze bestanden kon geüpload worden.",
      Object.fromEntries(rejected.map((item) => [item.fileName, item.reason])),
    );
  }

  const storage = getUploadStorage();
  const assets: ProjectAsset[] = [];
  /** Elke rij die dit verzoek gemaakt heeft, ook de rij die nog geen bestand had. */
  const created: ID[] = [];

  try {
    for (const file of accepted) {
      const asset = await store.createAsset({
        organisationId,
        projectId,
        uploadedBy: userId,
        kind: "image",
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeInBytes: file.size,
      });

      created.push(asset.id);

      const stored = await storage.put({
        assetId: asset.id,
        fileName: file.name,
        contentType: file.type,
        data: new Uint8Array(await file.arrayBuffer()),
      });

      const attached = await store.attachStorage(organisationId, asset.id, {
        storageKey: stored.key,
        sizeInBytes: stored.sizeInBytes,
      });

      assets.push(attached ?? asset);
    }
  } catch (error) {
    // Halverwege stukgelopen: wat er van deze upload al stond, gaat weer weg.
    // Een half aangekomen selectie is erger dan een mislukte — de gebruiker
    // duwt gewoon opnieuw, en dan hoort hij niet de helft dubbel te krijgen.
    for (const assetId of created) await store.deleteAsset(organisationId, assetId);

    throw error;
  }

  const style = templateStyle(project.templateId);

  const scenes: SceneInput[] = [
    // Bestaande scènes met alleen hun id: wat we niet meesturen, blijft staan.
    ...sortedScenes(project.scenes).map((scene) => ({ id: scene.id })),
    ...assets.map((asset) => ({
      assetId: asset.id,
      durationInSeconds: secondsPerPhotoFor(null),
      motion: style.motion,
      transition: style.transition,
    })),
  ];

  return {
    assets,
    rejected,
    project: await saveProjectChanges(organisationId, projectId, { scenes }),
  };
}

export type ReorderResult = {
  assets: ProjectAsset[];
  project: VideoProject;
};

/**
 * De volgorde bewaren.
 *
 * `assetIds` is de volledige rij en niet een verplaatsing ("zet deze twee naar
 * voren"). Dat is expres: een volledige rij is idempotent — twee keer versturen
 * geeft twee keer hetzelfde resultaat — en ze kan niet half aankomen. Klopt ze
 * niet meer met wat er in het project staat, dan is de client verouderd en
 * zeggen we dat, in plaats van er een volgorde van te maken die niemand bedoeld
 * heeft.
 */
export async function reorderProjectAssets(input: {
  organisationId: ID;
  projectId: ID;
  assetIds: ID[];
}): Promise<ReorderResult> {
  const { organisationId, projectId, assetIds } = input;

  const project = await loadOwnProject(organisationId, projectId);
  const store = getProjectAssetStore();
  const current = await store.listForProject(organisationId, projectId);

  if (new Set(assetIds).size !== assetIds.length) {
    throw invalidInput("Er staat een foto twee keer in deze volgorde.");
  }

  const known = new Set(current.map((asset) => asset.id));
  const missing = current.filter((asset) => !assetIds.includes(asset.id));
  const unknown = assetIds.filter((assetId) => !known.has(assetId));

  if (missing.length > 0 || unknown.length > 0) {
    throw conflict(
      "Deze volgorde klopt niet meer met de foto's van dit project. Haal ze opnieuw op.",
    );
  }

  const assets = await store.reorder(organisationId, projectId, assetIds);

  return {
    assets,
    project: await saveProjectChanges(organisationId, projectId, {
      scenes: reorderScenes(project.scenes, assetIds),
    }),
  };
}

/**
 * De scènes in de nieuwe volgorde van de foto's.
 *
 * Scènes zonder foto — een upload die nooit afgerond is — schuiven mee naar
 * achteren in plaats van te verdwijnen. Ze hebben hun instellingen nog, en die
 * zijn het waard om te bewaren tot iemand ze bewust weghaalt.
 */
function reorderScenes(scenes: Scene[], assetIds: ID[]): SceneInput[] {
  const rank = new Map(assetIds.map((assetId, index) => [assetId, index]));
  const ordered = sortedScenes(scenes);

  const withAsset = ordered.filter((scene) => scene.assetId && rank.has(scene.assetId));
  const rest = ordered.filter((scene) => !scene.assetId || !rank.has(scene.assetId));

  withAsset.sort((a, b) => rank.get(a.assetId!)! - rank.get(b.assetId!)!);

  return [...withAsset, ...rest].map((scene) => ({ id: scene.id }));
}

function sortedScenes(scenes: Scene[]): Scene[] {
  return [...scenes].sort((a, b) => a.order - b.order);
}
