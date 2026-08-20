import {
  SEED_ORGANISATION_ID,
  SEED_PROJECT_IDS,
  days,
  hours,
  isSeedEnabled,
  seedTime,
} from "@/db/seed/config";
import { seedBrandKit } from "@/db/seed/brand";
import { createAudio } from "@/lib/editor/audio";
import { createBranding } from "@/lib/editor/branding";
import { timelineDuration, toEditorDocument } from "@/lib/editor/document";
import { presetMotion } from "@/lib/editor/motion";
import type { TransitionId } from "@/lib/editor/templates";
import type { ID, Scene, SceneMotion, VideoProject } from "@/types";

/**
 * Drie panden, drie toestanden.
 *
 * Ze zijn zo gekozen dat elk scherm van de app iets te tonen heeft zonder dat
 * er een vierde project nodig is:
 *
 * | Project        | Status       | Waarvoor het er staat                        |
 * | -------------- | ------------ | -------------------------------------------- |
 * | Leiestraat 44  | klaar        | Twee afgewerkte renders → de downloadpagina   |
 * | Zuidparklaan 8 | mislukt      | Een fout die te herkansen is → de foutafhandeling |
 * | Dageraadplaats | in-bewerking | Het project om de editor mee te openen        |
 *
 * De scènes hebben géén `assetId`, en dat is geen vergetelheid. Er is nog geen
 * object storage (zie de TODO in `project-store.ts`), dus er bestaat geen
 * enkele asset om naar te wijzen. Een verzonnen id zou een foto beloven die
 * nergens staat; `null` is wat de editor al netjes toont — een grijs kader met
 * de bestandsnaam. De bijschriften zijn er wél, want die komen uit het
 * project en niet uit de opslag: daarmee heeft de preview meteen inhoud.
 */

type SceneInput = {
  /** Wat er te zien is; wordt het bijschrift bovenaan. */
  caption: string | null;
  durationInSeconds: number;
  /** Alleen wanneer deze scène afwijkt van de beweging van het template. */
  motion?: SceneMotion;
};

function buildScenes(
  projectId: ID,
  inputs: SceneInput[],
  style: { motion: SceneMotion; transition: TransitionId },
): Scene[] {
  return inputs.map((input, index) => ({
    id: `scn_${projectId.replace(/^prj_/, "")}_${String(index + 1).padStart(2, "0")}`,
    order: index,
    assetId: null,
    durationInSeconds: input.durationInSeconds,
    motion: input.motion ?? style.motion,
    transition: style.transition,
    captionTop: input.caption,
    captionBottom: null,
  }));
}

/**
 * De duur die in de lijst en op het dashboard staat, is de duur die de editor
 * berekent — inclusief intro, slotkaart en de overlap van elke overgang. Ze
 * hier apart invullen zou betekenen dat het getal verspringt zodra iemand het
 * project opent en bewaart.
 */
function withTimelineDuration(project: VideoProject): VideoProject {
  return {
    ...project,
    durationInSeconds: timelineDuration(toEditorDocument(project, seedBrandKit())),
  };
}

/** Leiestraat 44 — een herenhuis dat af is. */
function herenhuis(): VideoProject {
  const id = SEED_PROJECT_IDS.herenhuis;
  const style = { motion: presetMotion("zoom-in"), transition: "crossfade" as TransitionId };

  return withTimelineDuration({
    id,
    organisationId: SEED_ORGANISATION_ID,
    propertyId: null,
    title: "Leiestraat 44 — herenhuis",
    status: "klaar",
    aspectRatio: "16:9",
    templateId: "tpl_klassiek",
    scenes: buildScenes(
      id,
      [
        { caption: "Leiestraat 44, Kortrijk", durationInSeconds: 5 },
        { caption: "Inkomhal met originele tegelvloer", durationInSeconds: 4 },
        { caption: "Leefruimte, 42 m²", durationInSeconds: 5 },
        { caption: "Open keuken met kookeiland", durationInSeconds: 4.5 },
        { caption: "Eetkamer met zicht op de tuin", durationInSeconds: 4 },
        // Een slaapkamer is klein: rustig pannen toont er meer van dan inzoomen.
        { caption: "Master bedroom", durationInSeconds: 4, motion: presetMotion("slow-pan") },
        { caption: "Badkamer met inloopdouche", durationInSeconds: 3.5 },
        { caption: "Zuidgerichte stadstuin", durationInSeconds: 5 },
      ],
      style,
    ),
    branding: createBranding({ logoPlacement: "rechtsonder", showPriceBadge: true }),
    audio: createAudio({ trackId: "trk_zacht_piano", volume: 0.6, fadeOutSeconds: 2.5 }),
    exportPresetIds: ["website-16x9", "linkedin-16x9"],
    musicAssetId: null,
    voiceoverAssetId: null,
    posterUrl: null,
    durationInSeconds: 0,
    createdAt: seedTime(-days(4)),
    updatedAt: seedTime(-hours(5)),
  });
}

/** Zuidparklaan 8 — een reel die stukliep op een foto. */
function appartement(): VideoProject {
  const id = SEED_PROJECT_IDS.appartement;
  const style = {
    motion: presetMotion("ken-burns", { focusY: 0.45 }),
    transition: "schuif" as TransitionId,
  };

  return withTimelineDuration({
    id,
    organisationId: SEED_ORGANISATION_ID,
    propertyId: null,
    title: "Zuidparklaan 8 — nieuwbouwappartement",
    status: "mislukt",
    aspectRatio: "9:16",
    templateId: "tpl_dynamisch",
    scenes: buildScenes(
      id,
      [
        { caption: "Nieuwbouw aan het Zuidpark", durationInSeconds: 3 },
        { caption: "Living met terrasdeuren", durationInSeconds: 2.5 },
        { caption: "Keuken, volledig ingericht", durationInSeconds: 2.5 },
        { caption: "Slaapkamer 1", durationInSeconds: 2.5 },
        { caption: "Slaapkamer 2", durationInSeconds: 2.5 },
        { caption: "Terras op het zuiden", durationInSeconds: 3 },
        { caption: "Gemeenschappelijke fietsenberging", durationInSeconds: 2.5 },
      ],
      style,
    ),
    branding: createBranding({ logoPlacement: "linksboven", showContactCard: true }),
    audio: createAudio({ trackId: "trk_lichte_beat", volume: 0.75 }),
    exportPresetIds: ["instagram-reels-9x16"],
    musicAssetId: null,
    voiceoverAssetId: null,
    posterUrl: null,
    durationInSeconds: 0,
    createdAt: seedTime(-days(2)),
    updatedAt: seedTime(-hours(9)),
  });
}

/** Dageraadplaats 3 — het project dat nog op tafel ligt. */
function belEtage(): VideoProject {
  const id = SEED_PROJECT_IDS.belEtage;
  const style = {
    motion: presetMotion("zoom-in", { intensity: 0.55, speed: 1.3, easing: "eind-traag" }),
    transition: "hard" as TransitionId,
  };

  return withTimelineDuration({
    id,
    organisationId: SEED_ORGANISATION_ID,
    propertyId: null,
    title: "Dageraadplaats 3 — bel-etage",
    status: "in-bewerking",
    aspectRatio: "1:1",
    templateId: "tpl_snel",
    scenes: buildScenes(
      id,
      [
        { caption: "Bel-etage aan de Dageraadplaats", durationInSeconds: 2 },
        { caption: "Salon met schouw", durationInSeconds: 2 },
        { caption: "Keuken", durationInSeconds: 2 },
        { caption: "Slaapkamer met erker", durationInSeconds: 2 },
        // Nog geen bijschrift: dit is het project dat nog niet af is.
        { caption: null, durationInSeconds: 2 },
        { caption: null, durationInSeconds: 2 },
      ],
      style,
    ),
    branding: createBranding({ logoPlacement: "rechtsboven", accentColor: "#8c3b2f" }),
    audio: createAudio({ trackId: "trk_stadspuls", volume: 0.8, fadeInSeconds: 0.5 }),
    exportPresetIds: ["instagram-feed-1x1", "facebook-1x1"],
    musicAssetId: null,
    voiceoverAssetId: null,
    posterUrl: null,
    durationInSeconds: 0,
    createdAt: seedTime(-days(1)),
    updatedAt: seedTime(-hours(2)),
  });
}

/**
 * De referentie en de gemeente van elk pand.
 *
 * Ze staan hier apart omdat ze bij het *pand* horen en niet bij de video: in
 * `src/types/property.ts` staat `Property` al klaar, maar er is nog geen store
 * voor. Tot die er is, leest het dashboard ze hier, en toont het ze niet voor
 * projecten die er niet in staan.
 */
const SEED_PROJECT_META: Record<ID, { reference: string; city: string }> = {
  [SEED_PROJECT_IDS.herenhuis]: { reference: "VK-2043", city: "Kortrijk" },
  [SEED_PROJECT_IDS.appartement]: { reference: "VK-2039", city: "Gent" },
  [SEED_PROJECT_IDS.belEtage]: { reference: "VK-2051", city: "Antwerpen" },
};

export function seedProjectMeta(projectId: ID): { reference: string; city: string } | null {
  if (!isSeedEnabled()) return null;

  return SEED_PROJECT_META[projectId] ?? null;
}

/** Nieuwste eerst, zoals de projectstore ze teruggeeft. */
export function seedProjects(): VideoProject[] {
  return [belEtage(), appartement(), herenhuis()];
}
