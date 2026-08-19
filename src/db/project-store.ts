import { randomUUID } from "node:crypto";
import { createAudio } from "@/lib/editor/audio";
import { createBranding } from "@/lib/editor/branding";
import type { ProjectPatch } from "@/lib/editor/document";
import { isExportPresetId } from "@/lib/editor/export-presets";
import { templateStyle } from "@/lib/editor/templates";
import { buildScenes, estimateDurationInSeconds } from "@/lib/new-project/draft";
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
  globalThis.__immoreelProjects ??= new Map();

  return globalThis.__immoreelProjects;
}

function createProjectId(): ID {
  return `prj_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

const memoryStore: ProjectStore = {
  async createProject(organisationId, input) {
    const now = new Date().toISOString();
    const style = templateStyle(input.templateId);
    const scenes = buildScenes(input.photos, input.secondsPerPhoto, {
      motion: style.motion,
      transition: style.transition,
    });

    const project: VideoProject = {
      id: createProjectId(),
      organisationId,
      propertyId: null,
      title: input.title,
      // Er zit al media in, dus dit is geen leeg concept meer: de gebruiker
      // gaat meteen door naar de editor.
      status: "in-bewerking",
      aspectRatio: input.aspectRatio,
      templateId: input.templateId,
      scenes,
      branding: createBranding(),
      audio: createAudio(),
      // Het doel uit de wizard heeft dezelfde id als de exportpreset ervan,
      // dus de editor stelt meteen de juiste export voor.
      exportPresetIds: isExportPresetId(input.goal) ? [input.goal] : [],
      musicAssetId: null,
      voiceoverAssetId: null,
      posterUrl: null,
      durationInSeconds: estimateDurationInSeconds(input.photos.length, input.secondsPerPhoto),
      createdAt: now,
      updatedAt: now,
    };

    // TODO: de foto's uit `input.photos` worden `MediaAsset`-rijen zodra er
    // object storage is. De scènes verwijzen nu al naar hun toekomstige id.
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
