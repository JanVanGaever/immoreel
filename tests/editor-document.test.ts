import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toEditorDocument } from "../src/lib/editor/document";
import { createBranding } from "../src/lib/editor/branding";
import { createAudio } from "../src/lib/editor/audio";
import { createBrandKit } from "../src/lib/brand/kit";
import type { Scene, VideoProject } from "../src/types";

/**
 * Van bewaard project naar wat de editor tekent.
 *
 * Hier zat een bug die de hele wizard doodliep. `toEditorDocument()` zette de
 * scènes goed neer maar gaf ze geen `previewUrl`, en dat veld is precies wat de
 * fotolijst, de preview-stage én het afspeelplan gebruiken om beeld te tonen.
 * Gevolg: wie vanuit de wizard in de editor kwam — of gewoon de pagina
 * herlaadde — zag een tijdlijn met de juiste scènes en niets erin. De foto's
 * stónden er, er wees alleen niets naar.
 *
 * Het werkte wél zolang je in de editor zelf foto's sleepte, want dan maakt de
 * browser een blob-URL. Die overleeft geen navigatie, en daarom viel het pas op
 * bij de stap waar de gebruiker hem het hardst nodig had.
 */

function project(scenes: Scene[]): VideoProject {
  const now = "2026-08-21T09:00:00.000Z";

  return {
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
    createdAt: now,
    updatedAt: now,
  };
}

function scene(order: number, assetId: string | null): Scene {
  return {
    id: `scn_${order}`,
    order,
    assetId,
    durationInSeconds: 4,
    motion: { kind: "inzoomen", intensity: 0.3, speed: 1, easing: "zacht", focusX: 0.5, focusY: 0.5 },
    transition: "crossfade",
    captionTop: null,
    captionBottom: null,
  };
}

const brand = createBrandKit("org_test");

describe("een scène met een foto", () => {
  it("krijgt het adres van die foto mee", () => {
    const document = toEditorDocument(project([scene(0, "ast_abc123")]), brand);

    assert.equal(document.scenes[0]?.source.previewUrl, "/api/assets/ast_abc123");
  });

  it("wijst naar de route en niet naar de opslag zelf", () => {
    const document = toEditorDocument(project([scene(0, "ast_abc123")]), brand);
    const url = document.scenes[0]?.source.previewUrl ?? "";

    // Een blob-URL hoort bij één tabblad; een opslag-URL zou de
    // rechtencontrole overslaan. Alleen onze eigen route klopt.
    assert.ok(url.startsWith("/api/assets/"), `onverwacht adres: ${url}`);
    assert.ok(!url.startsWith("blob:"));
    assert.ok(!url.includes("amazonaws") && !url.includes("file:"));
  });

  it("geeft elke scène zijn eigen foto", () => {
    const document = toEditorDocument(
      project([scene(0, "ast_een"), scene(1, "ast_twee"), scene(2, "ast_drie")]),
      brand,
    );

    assert.deepEqual(
      document.scenes.map((s) => s.source.previewUrl),
      ["/api/assets/ast_een", "/api/assets/ast_twee", "/api/assets/ast_drie"],
    );
  });
});

describe("een scène zonder foto", () => {
  /**
   * Blijft leeg, en dat is de bedoeling: zo staan de demoprojecten erin, en zo
   * ziet een upload eruit die halverwege afbrak. Een adres verzinnen zou een
   * verzoek opleveren dat gegarandeerd 404 geeft.
   */
  it("houdt previewUrl op null", () => {
    const document = toEditorDocument(project([scene(0, null)]), brand);

    assert.equal(document.scenes[0]?.source.previewUrl, null);
    assert.equal(document.scenes[0]?.source.assetId, null);
  });
});

describe("de volgorde", () => {
  it("hernummert de scènes en houdt de foto's erbij", () => {
    const document = toEditorDocument(
      project([scene(5, "ast_laatste"), scene(1, "ast_eerste")]),
      brand,
    );

    assert.deepEqual(
      document.scenes.map((s) => [s.order, s.source.previewUrl]),
      [
        [0, "/api/assets/ast_eerste"],
        [1, "/api/assets/ast_laatste"],
      ],
    );
  });
});
