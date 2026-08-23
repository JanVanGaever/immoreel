import { randomUUID } from "node:crypto";
import { isSeedEnabled, seedProjects } from "@/db/seed";
import { createAudio } from "@/lib/editor/audio";
import { createBranding } from "@/lib/editor/branding";
import type { ProjectPatch } from "@/lib/editor/document";
import { defaultPresetIdsForGoal } from "@/lib/editor/export-presets";
import { estimateDurationInSeconds } from "@/lib/new-project/draft";
import type { ID, NewProjectInput, VideoProject } from "@/types";

/**
 * Projecten achter één poort, net als de auth- en dashboardstore. Hier komt
 * binnen wat de wizard oplevert (`NewProjectInput`) en gaat uit wat de editor
 * leest (`VideoProject`).
 *
 * De implementatie hieronder houdt alles in het geheugen van het proces: goed
 * genoeg om de flow van wizard naar editor te draaien, niet voor productie.
 * Zodra de ORM gekozen is, schrijf je één nieuwe implementatie van dezelfde
 * interface.
 */
export type ProjectStore = {
  /** Maakt het project dat de wizard heeft samengesteld. */
  createProject(organisationId: ID, input: NewProjectInput): Promise<VideoProject>;
  findProject(organisationId: ID, projectId: ID): Promise<VideoProject | null>;
  listProjects(organisationId: ID): Promise<VideoProject[]>;
  /** Wat de editor bewaart. Geeft `null` als het project niet (meer) bestaat. */
  updateProject(
    organisationId: ID,
    projectId: ID,
    patch: ProjectPatch,
  ): Promise<VideoProject | null>;
  /**
   * Alle projecten, over alle organisaties heen. Alleen voor het interne
   * supportpaneel (`src/db/admin-store.ts`); elke andere lezer hoort met een
   * `organisationId` binnen te komen.
   */
  listAllProjects(): Promise<VideoProject[]>;
  /** Zet de status, bijvoorbeeld wanneer een export in de wachtrij gaat. */
  setProjectStatus(
    organisationId: ID,
    projectId: ID,
    status: VideoProject["status"],
  ): Promise<VideoProject | null>;
};

declare global {
  var __immoreelProjects: Map<ID, VideoProject> | undefined;
}

function getData(): Map<ID, VideoProject> {
  globalThis.__immoreelProjects ??= seed(new Map());

  return globalThis.__immoreelProjects;
}

/**
 * De drie panden van het demokantoor (`src/db/seed/projects.ts`).
 *
 * Ze staan hier en niet alleen op het dashboard, en dat is het hele punt: de
 * dashboardstore toonde vroeger projecten die in deze map niet bestonden, dus
 * gaf klikken op "Recente projecten" een 404. Nu is het dezelfde rij.
 */
function seed(data: Map<ID, VideoProject>): Map<ID, VideoProject> {
  if (!isSeedEnabled()) return data;

  for (const project of seedProjects()) data.set(project.id, project);

  return data;
}

function createProjectId(): ID {
  return `prj_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

const memoryStore: ProjectStore = {
  /**
   * Het project van de wizard, nog zonder tijdlijn.
   *
   * De scènes ontstaan pas wanneer de foto's geüpload zijn
   * (`uploadProjectAssets`), en dat is geen omweg maar de enige manier waarop
   * ze naar bestaande bestanden kunnen wijzen. Eerder stonden hier scènes met
   * `assetId: photo.id` — het id van een `DraftPhoto`, verzonnen in de browser
   * en nergens een rij in `project_assets`. Elke render daarop liep vast op
   * `assets-missing`.
   *
   * `input.photos` blijft wel meekomen: de validatie gebruikt het aantal (een
   * video zonder foto's is geen video) en de geschatte duur zet alvast een
   * eerlijk getal in de projectlijst.
   */
  async createProject(organisationId, input) {
    const now = new Date().toISOString();

    const project: VideoProject = {
      id: createProjectId(),
      organisationId,
      propertyId: null,
      title: input.title,
      // De foto's zijn gekozen en gaan zo de deur uit; dit is geen leeg
      // concept meer, ook al staat de tijdlijn nog op het punt te ontstaan.
      status: "in-bewerking",
      aspectRatio: input.aspectRatio,
      templateId: input.templateId,
      scenes: [],
      branding: createBranding(),
      audio: createAudio(),
      // Het doel uit de wizard bepaalt welke export al aangevinkt staat, zodat
      // de editor meteen het juiste bestand voorstelt.
      exportPresetIds: defaultPresetIdsForGoal(input.goal),
      musicAssetId: null,
      voiceoverAssetId: null,
      posterUrl: null,
      // Een schatting, tot de upload de echte scènes neerzet en
      // `toProjectPatch()` de duur uitrekent.
      durationInSeconds: estimateDurationInSeconds(input.photos.length, input.secondsPerPhoto),
      createdAt: now,
      updatedAt: now,
    };

    getData().set(project.id, project);

    return project;
  },

  async findProject(organisationId, projectId) {
    const project = getData().get(projectId);
    if (!project || project.organisationId !== organisationId) return null;

    return project;
  },

  async listProjects(organisationId) {
    return [...getData().values()]
      .filter((project) => project.organisationId === organisationId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async updateProject(organisationId, projectId, patch) {
    const project = getData().get(projectId);
    if (!project || project.organisationId !== organisationId) return null;

    const updated: VideoProject = {
      ...project,
      title: patch.title,
      aspectRatio: patch.aspectRatio,
      templateId: patch.templateId,
      scenes: patch.scenes,
      branding: patch.branding,
      audio: patch.audio,
      exportPresetIds: patch.exportPresetIds,
      durationInSeconds: patch.durationInSeconds,
      updatedAt: new Date().toISOString(),
    };

    getData().set(projectId, updated);

    return updated;
  },

  async listAllProjects() {
    return [...getData().values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async setProjectStatus(organisationId, projectId, status) {
    const project = getData().get(projectId);
    if (!project || project.organisationId !== organisationId) return null;

    const updated: VideoProject = { ...project, status, updatedAt: new Date().toISOString() };
    getData().set(projectId, updated);

    return updated;
  },
};

export function getProjectStore(): ProjectStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  return memoryStore;
}
