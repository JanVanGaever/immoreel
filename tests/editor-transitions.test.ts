import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTimeline, toEditorDocument } from "../src/lib/editor/document";
import { buildPreviewPlan } from "../src/lib/editor/preview-plan";
import { buildRenderPlan } from "../src/lib/editor/render-plan";
import { findExportPreset } from "../src/lib/editor/export-presets";
import { createBrandKit } from "../src/lib/brand/kit";
import { createBranding } from "../src/lib/editor/branding";
import { createAudio } from "../src/lib/editor/audio";
import type { Scene, VideoProject } from "../src/types";

/**
 * De overgang tussen twee scènes.
 *
 * Hier zat een fout die je alleen zag als je hem niet zocht. De editor laat je
 * per scène een overgang kiezen — "Hoe deze scène in de volgende overgaat" —
 * maar de tijdlijn en de preview rekenden met één overgang voor het hele
 * project. Zodra twee scènes van elkaar verschilden, viel dat terug op de
 * overgang van het template.
 *
 * Het gevolg: wie één scène op "harde cut" zette, zag er niets van gebeuren. En
 * omdat `buildRenderPlan()` altijd al wél per scène rekende, kreeg hij daarna
 * een video waarin die harde cut er wél in zat. De preview loog dus tegen de
 * makelaar, en dat is precies de belofte die deze app niet mag breken.
 */

const scene = (order: number, transition: string): Scene => ({
  id: `scn_${order}`,
  order,
  assetId: `ast_${order}`,
  durationInSeconds: 4,
  motion: { kind: "inzoomen", intensity: 0.3, speed: 1, easing: "zacht", focusX: 0.5, focusY: 0.5 },
  transition: transition as Scene["transition"],
  captionTop: null,
  captionBottom: null,
});

function document(scenes: Scene[]) {
  return toEditorDocument(
    {
      id: "prj_test",
      organisationId: "org_test",
      title: "Teststraat 1",
      status: "in-bewerking",
      aspectRatio: "9:16",
      templateId: "tpl_klassiek",
      scenes,
      branding: createBranding(),
      audio: createAudio(),
      exportPresetIds: [],
      durationInSeconds: 15,
      createdAt: "2026-08-21T09:00:00.000Z",
      updatedAt: "2026-08-21T09:00:00.000Z",
    } as VideoProject,
    createBrandKit("org_test"),
  );
}

/** Alleen de slides die bij een scène horen; intro en contactkaart niet. */
function previewTransitions(scenes: Scene[]): string[] {
  return buildPreviewPlan(document(scenes))
    .slides.filter((slide) => slide.sceneId)
    .map((slide) => slide.transition);
}

function renderTransitions(scenes: Scene[]): string[] {
  const preset = findExportPreset("instagram-reels-9x16")!;

  return buildRenderPlan(document(scenes), preset).scenes.map((slide) => slide.transition);
}

describe("de preview volgt de overgang van elke scène", () => {
  it("toont drie verschillende overgangen als er drie gekozen zijn", () => {
    const scenes = [scene(0, "hard"), scene(1, "schuif"), scene(2, "dip-to-black")];

    assert.deepEqual(previewTransitions(scenes), ["hard", "schuif", "dip-to-black"]);
  });

  /** Het geval waarin het misging: één afwijkende scène tussen de rest. */
  it("laat één afwijkende scène niet in de massa verdwijnen", () => {
    const scenes = [scene(0, "crossfade"), scene(1, "schuif"), scene(2, "crossfade")];

    assert.deepEqual(previewTransitions(scenes), ["crossfade", "schuif", "crossfade"]);
  });

  it("blijft kloppen als alle scènes hetzelfde hebben", () => {
    const scenes = [scene(0, "schuif"), scene(1, "schuif"), scene(2, "schuif")];

    assert.deepEqual(previewTransitions(scenes), ["schuif", "schuif", "schuif"]);
  });
});

describe("preview en render zeggen hetzelfde", () => {
  /**
   * De kern van deze fix. Wat de makelaar ziet en wat er gerenderd wordt, komt
   * uit twee verschillende functies; die mogen nooit een ander antwoord geven
   * op dezelfde vraag.
   */
  for (const [label, scenes] of [
    ["drie verschillende", [scene(0, "hard"), scene(1, "schuif"), scene(2, "dip-to-black")]],
    ["één afwijkend", [scene(0, "crossfade"), scene(1, "schuif"), scene(2, "crossfade")]],
    ["allemaal gelijk", [scene(0, "crossfade"), scene(1, "crossfade"), scene(2, "crossfade")]],
    ["allemaal hard", [scene(0, "hard"), scene(1, "hard"), scene(2, "hard")]],
  ] as [string, Scene[]][]) {
    it(`komen overeen bij ${label}`, () => {
      assert.deepEqual(previewTransitions(scenes), renderTransitions(scenes));
    });
  }
});

describe("de tijdlijn schuift per scène", () => {
  /**
   * Een harde cut duurt nul seconden en een crossfade een halve. Een tijdlijn
   * die overal dezelfde overlap gebruikt, zet de blokken dus op de verkeerde
   * plek zodra de scènes verschillen.
   */
  it("laat een harde cut niet overlappen", () => {
    const hard = buildTimeline(document([scene(0, "hard"), scene(1, "hard"), scene(2, "hard")]));
    const zacht = buildTimeline(
      document([scene(0, "crossfade"), scene(1, "crossfade"), scene(2, "crossfade")]),
    );

    // Zonder overlap duurt dezelfde tijdlijn langer.
    assert.ok(
      hard.durationInSeconds > zacht.durationInSeconds,
      `hard ${hard.durationInSeconds}s hoort langer te zijn dan crossfade ${zacht.durationInSeconds}s`,
    );
  });

  it("reageert op het wijzigen van één enkele overgang", () => {
    const voor = buildTimeline(
      document([scene(0, "crossfade"), scene(1, "crossfade"), scene(2, "crossfade")]),
    );
    const na = buildTimeline(
      document([scene(0, "crossfade"), scene(1, "hard"), scene(2, "crossfade")]),
    );

    // Dit is letterlijk de klacht: "ik zie geen verschil wanneer ik iets
    // aanpas". Eén overgang wijzigen hoort de tijdlijn te verschuiven.
    assert.notEqual(
      voor.durationInSeconds,
      na.durationInSeconds,
      "het wijzigen van één overgang verandert niets aan de tijdlijn",
    );
  });
});
