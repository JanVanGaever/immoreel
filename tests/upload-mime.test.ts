import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalMimeType,
  normaliseMimeType,
  rejectionFor,
} from "../src/lib/uploads/validation";

/**
 * Een upload die zich voordoet als een pagina.
 *
 * Bewezen vóór deze tests: `payload.jpg` met `Content-Type: text/html` werd
 * aangenomen (201, `rejected: []`), als `mimeType: "text/html"` bewaard, en door
 * `/api/assets/:id` teruggegeven met precies die kop en `inline` erbij. De
 * browser maakte er een pagina van op ons eigen domein — stored XSS.
 *
 * De oorzaak was één woord: `rejectionFor()` accepteerde op mimetype **of**
 * extensie. Deze tests houden die `of` weg.
 */

const bestand = (name: string, type: string, size = 1024) => ({ name, type, size });

describe("wat er als foto binnen mag", () => {
  it("weigert HTML die zich voordoet als een foto", () => {
    const rejection = rejectionFor(bestand("payload.jpg", "text/html"));

    assert.ok(rejection, "text/html werd aangenomen omdat het bestand .jpg heet");
    assert.equal(rejection.code, "unsupported-media");
  });

  it("weigert een script met een fotonaam", () => {
    assert.ok(rejectionFor(bestand("foto.png", "application/javascript")));
    assert.ok(rejectionFor(bestand("foto.jpeg", "image/svg+xml")));
  });

  it("laat een gewone foto door", () => {
    assert.equal(rejectionFor(bestand("gevel.jpg", "image/jpeg")), undefined);
    assert.equal(rejectionFor(bestand("plan.png", "image/png")), undefined);
    assert.equal(rejectionFor(bestand("tuin.webp", "image/webp")), undefined);
  });

  /**
   * De reden dat de extensie überhaupt meetelt: een iPhone stuurt bij een
   * HEIC-foto soms geen mimetype mee. Dat geval moet blijven werken, anders is
   * de fix een regressie voor echte gebruikers.
   */
  it("laat een HEIC zonder mimetype door", () => {
    assert.equal(rejectionFor(bestand("IMG_0421.heic", "")), undefined);
    assert.equal(rejectionFor(bestand("IMG_0421.HEIC", "application/octet-stream")), undefined);
  });

  it("laat schrijfwijzen door die hetzelfde bedoelen", () => {
    assert.equal(rejectionFor(bestand("gevel.jpg", "image/jpg")), undefined);
    assert.equal(rejectionFor(bestand("gevel.jpg", "IMAGE/JPEG")), undefined);
    assert.equal(rejectionFor(bestand("gevel.jpg", "image/jpeg; charset=binary")), undefined);
  });

  it("blijft weigeren op grootte en leegte", () => {
    assert.equal(rejectionFor(bestand("groot.jpg", "image/jpeg", 26 * 1024 * 1024))?.code, "too-large");
    assert.equal(rejectionFor(bestand("leeg.jpg", "image/jpeg", 0))?.code, "upload-rejected");
  });
});

describe("wat we van een bestand bewaren", () => {
  /** Nooit de waarde van de client: altijd een van de onze, of niets. */
  it("geeft nooit het mimetype terug dat de client verzon", () => {
    assert.equal(canonicalMimeType(bestand("payload.jpg", "text/html")), null);
    assert.equal(canonicalMimeType(bestand("x.jpg", "image/jpg")), "image/jpeg");
    assert.equal(canonicalMimeType(bestand("x.heic", "")), "image/heic");
  });

  it("normaliseert parameters en hoofdletters weg", () => {
    assert.equal(normaliseMimeType("IMAGE/JPEG; charset=binary"), "image/jpeg");
    assert.equal(normaliseMimeType("image/jpg"), "image/jpeg");
    assert.equal(normaliseMimeType(""), "");
  });
});
