import type { EditorDocument } from "@/lib/editor/document";
import type { ExportPreset } from "@/lib/editor/export-presets";
import { normaliseMotion, toZoompanFilter, type ZoompanFilter } from "@/lib/editor/motion";
import { getTransition, templateStyle, type TransitionId } from "@/lib/editor/templates";
import { resolveBrand } from "@/lib/brand/kit";
import type { ID, ResolvedBrand, SceneMotion } from "@/types";

/**
 * Wat de renderpijplijn straks krijgt.
 *
 * De editor bewaart instellingen; dit vertaalt ze naar wat FFmpeg nodig heeft,
 * per foto: het bronbestand, hoeveel frames het in beeld blijft en de
 * `zoompan`-filter die de beweging maakt. Er wordt hier niets uitgevoerd en
 * niets gegenereerd — het is een beschrijving, meer niet.
 *
 * Dat het hier al kan, is meteen de test op de motionmodule: als een instelling
 * niet in een filterstring te vatten is, is ze een knop zonder betekenis.
 */

export type ScenePlan = {
  sceneId: ID;
  /** `null` zolang de foto nog niet in de opslag staat. */
  assetId: ID | null;
  order: number;
  durationInSeconds: number;
  /** Aantal frames bij de framerate van de preset. */
  frames: number;
  motion: SceneMotion;
  zoompan: ZoompanFilter;
  transition: TransitionId;
  /** Overlap met de vorige scène; 0 bij de eerste en bij een harde cut. */
  transitionInSeconds: number;
};

export type RenderPlan = {
  presetId: ID;
  /** Titel van het project; komt op de introkaart terecht. */
  title: string;
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  container: string;
  /** Formaat zoals `zoompan` het wil: `1920x1080`. */
  size: string;
  introSeconds: number;
  outroSeconds: number;
  durationInSeconds: number;
  scenes: ScenePlan[];
  audio: EditorDocument["audio"];
  /** Waar het logo staat en welke kaarten mee moeten. */
  branding: EditorDocument["branding"];
  /**
   * De huisstijl van het kantoor met de afwijkingen van dit project erin
   * verwerkt. De worker draait los van de databank en kan de kit dus niet zelf
   * opzoeken; ze zit daarom in het plan, zoals alles wat de render nodig heeft.
   */
  brand: ResolvedBrand;
  /** Foto's die nog geen asset in de opslag hebben; die kunnen niet mee. */
  missingAssets: ID[];
};

export function buildRenderPlan(document: EditorDocument, preset: ExportPreset): RenderPlan {
  const style = templateStyle(document.templateId);
  const size = `${preset.width}x${preset.height}`;

  const scenes: ScenePlan[] = document.scenes.map((scene, index) => {
    const motion = normaliseMotion(scene.motion);
    const transition = (scene.transition as TransitionId | null) ?? style.transition;
    const zoompan = toZoompanFilter(motion, {
      durationInSeconds: scene.durationInSeconds,
      fps: preset.fps,
      size,
    });

    return {
      sceneId: scene.id,
      assetId: scene.source.assetId,
      order: index,
      durationInSeconds: scene.durationInSeconds,
      frames: zoompan.frames,
      motion,
      zoompan,
      transition,
      // De eerste scène heeft niets om overheen te lopen.
      transitionInSeconds: index === 0 ? 0 : getTransition(transition).durationInSeconds,
    };
  });

  const beeld = scenes.reduce(
    (total, scene) => total + scene.durationInSeconds - scene.transitionInSeconds,
    0,
  );
  const outroSeconds = document.branding.showContactCard ? style.outroSeconds : 0;

  return {
    presetId: preset.id,
    title: document.title.trim(),
    width: preset.width,
    height: preset.height,
    fps: preset.fps,
    videoBitrateKbps: preset.videoBitrateKbps,
    audioBitrateKbps: preset.audioBitrateKbps,
    container: preset.container,
    size,
    introSeconds: style.introSeconds,
    outroSeconds,
    durationInSeconds: Math.round((style.introSeconds + beeld + outroSeconds) * 10) / 10,
    scenes,
    audio: document.audio,
    branding: document.branding,
    brand: resolveBrand(document.brand, document.branding),
    missingAssets: document.scenes
      .filter((scene) => !scene.source.assetId)
      .map((scene) => scene.id),
  };
}
