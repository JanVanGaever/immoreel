import { randomUUID } from "node:crypto";
import type { ID, MediaKind, ProjectAsset } from "@/types";

/**
 * De foto's van een project achter één poort, net als de project- en
 * renderjobstore.
 *
 * Twee dingen liggen hier vast en nergens anders. Het eerste is dat een asset
 * bij één project hoort én bij één organisatie: elke lezer komt binnen met een
 * `organisationId`, zodat een id uit een URL nooit genoeg is om aan een bestand
 * van een ander kantoor te raken. Het tweede is dat `position` doorlopend is en
 * bij het herschikken in één keer hernummerd wordt — precies zoals de
 * databankversie het straks doet (zie `prisma/schema.prisma`), en de reden dat
 * er geen unieke index op staat.
 *
 * De implementatie hieronder houdt alles in het geheugen van het proces. Zodra
 * de ORM gekozen is, schrijf je één nieuwe implementatie van dezelfde
 * interface; de uploadroute merkt daar niets van.
 */
export type CreateProjectAssetInput = {
  organisationId: ID;
  projectId: ID;
  uploadedBy: ID | null;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
  width?: number | null;
  height?: number | null;
};

export type ProjectAssetStore = {
  /**
   * Zet de asset achteraan in de rij van dit project. `storageKey` blijft leeg
   * tot het bestand er echt staat: een rij zonder sleutel is een upload die
   * nog loopt of die misliep.
   */
  createAsset(input: CreateProjectAssetInput): Promise<ProjectAsset>;
  /** De sleutel en de gemeten grootte erbij, zodra de opslag het bestand heeft. */
  attachStorage(
    organisationId: ID,
    assetId: ID,
    stored: { storageKey: string; sizeInBytes: number },
  ): Promise<ProjectAsset | null>;
  findAsset(organisationId: ID, assetId: ID): Promise<ProjectAsset | null>;
  /** Alle foto's van dit project, op volgorde. */
  listForProject(organisationId: ID, projectId: ID): Promise<ProjectAsset[]>;
  /**
   * De volgorde herschrijven. `order` is de volledige rij: wat er niet in
   * staat, hoort er niet meer bij te zijn. Geeft de rij terug zoals ze nu is.
   */
  reorder(organisationId: ID, projectId: ID, order: ID[]): Promise<ProjectAsset[]>;
  /**
   * De rij weghalen. Bedoeld om een upload terug te draaien die halverwege
   * misliep: eerst staat de rij er, dan pas het bestand, en zonder bestand
   * hoort er geen rij te blijven staan.
   */
  deleteAsset(organisationId: ID, assetId: ID): Promise<void>;
};

declare global {
  var __immoreelProjectAssets: Map<ID, ProjectAsset> | undefined;
}

function getData(): Map<ID, ProjectAsset> {
  globalThis.__immoreelProjectAssets ??= new Map();

  return globalThis.__immoreelProjectAssets;
}

function createAssetId(): ID {
  return `ast_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Van dit project, van dit kantoor, op volgorde. */
function ownAssets(organisationId: ID, projectId: ID): ProjectAsset[] {
  return [...getData().values()]
    .filter((asset) => asset.organisationId === organisationId && asset.projectId === projectId)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

const memoryStore: ProjectAssetStore = {
  async createAsset(input) {
    const now = new Date().toISOString();
    const siblings = ownAssets(input.organisationId, input.projectId);

    const asset: ProjectAsset = {
      id: createAssetId(),
      organisationId: input.organisationId,
      projectId: input.projectId,
      uploadedBy: input.uploadedBy,
      kind: input.kind,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeInBytes: input.sizeInBytes,
      width: input.width ?? null,
      height: input.height ?? null,
      durationInSeconds: null,
      storageKey: "",
      // Een miniatuur maken we pas als er beeldverwerking is; tot dan toont de
      // uploadlijst het bestand zelf via `/api/assets/:assetId`.
      thumbnailUrl: null,
      position: siblings.length,
      createdAt: now,
      updatedAt: now,
    };

    getData().set(asset.id, asset);

    return asset;
  },

  async attachStorage(organisationId, assetId, stored) {
    const asset = getData().get(assetId);
    if (!asset || asset.organisationId !== organisationId) return null;

    const updated: ProjectAsset = {
      ...asset,
      storageKey: stored.storageKey,
      // Wat de opslag gemeten heeft wint van wat de browser beweerde.
      sizeInBytes: stored.sizeInBytes,
      updatedAt: new Date().toISOString(),
    };

    getData().set(assetId, updated);

    return updated;
  },

  async findAsset(organisationId, assetId) {
    const asset = getData().get(assetId);
    if (!asset || asset.organisationId !== organisationId) return null;

    return asset;
  },

  async listForProject(organisationId, projectId) {
    return ownAssets(organisationId, projectId);
  },

  async reorder(organisationId, projectId, order) {
    const now = new Date().toISOString();
    const assets = ownAssets(organisationId, projectId);
    const byId = new Map(assets.map((asset) => [asset.id, asset]));

    for (const [position, assetId] of order.entries()) {
      const asset = byId.get(assetId);
      // Een id dat hier niet hoort, wordt genegeerd en niet aangemaakt: de
      // aanroeper heeft de volledige rij al gecontroleerd (zie
      // `reorderProjectAssets`), en stil een asset verzinnen zou dat verbergen.
      if (!asset) continue;

      getData().set(asset.id, { ...asset, position, updatedAt: now });
    }

    return ownAssets(organisationId, projectId);
  },

  async deleteAsset(organisationId, assetId) {
    const asset = getData().get(assetId);
    if (!asset || asset.organisationId !== organisationId) return;

    getData().delete(assetId);
  },
};

export function getProjectAssetStore(): ProjectAssetStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  return memoryStore;
}
