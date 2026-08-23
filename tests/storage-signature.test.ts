import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_PAYLOAD_HASH,
  deriveSigningKey,
  sha256Hex,
  signRequest,
  toAmzDate,
} from "../src/lib/storage/signature";
import { encodeStorageKey, objectUrl, type StorageConfig } from "../src/lib/storage/config";

/**
 * De handtekening tegen de testvectoren van AWS zelf.
 *
 * Dit is de reden dat deze koppeling zonder SDK gebouwd is: de berekening is
 * hiermee te bewijzen zonder ook maar één bucket, terwijl een SDK zonder echte
 * sleutels helemaal niet te controleren valt. Klopt er hier iets niet, dan
 * weigert elke aanroep straks met "SignatureDoesNotMatch" en zegt die melding
 * niet waaróm.
 */

/** De sleutel uit de voorbeelden van AWS; hij hoort nergens bij een echte account. */
const EXAMPLE_SECRET = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";

describe("de ondertekeningssleutel", () => {
  /** Uit "Examples of how to derive a signing key" in de AWS-documentatie. */
  it("komt uit op de sleutel uit de documentatie", async () => {
    const key = await deriveSigningKey({
      secretAccessKey: EXAMPLE_SECRET,
      dateStamp: "20120215",
      region: "us-east-1",
      service: "iam",
    });

    const hex = [...new Uint8Array(key)].map((b) => b.toString(16).padStart(2, "0")).join("");

    assert.equal(hex, "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d");
  });
});

describe("de hash van een leeg lichaam", () => {
  it("klopt met de constante die we vastgelegd hebben", async () => {
    assert.equal(await sha256Hex(""), EMPTY_PAYLOAD_HASH);
  });
});

describe("get-vanilla uit de aws-sig-v4-test-suite", () => {
  /**
   * Het eenvoudigste geval uit de officiële reeks: GET op de wortel, geen
   * query, twee kopregels. Loopt dit, dan staan de canonieke vorm, de
   * tekenreeks en de sleutelafleiding alle drie goed.
   */
  it("geeft de handtekening uit de testreeks", async () => {
    const signed = await signRequest({
      method: "GET",
      path: "/",
      headers: { host: "example.amazonaws.com" },
      payloadHash: EMPTY_PAYLOAD_HASH,
      region: "us-east-1",
      service: "service",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: EXAMPLE_SECRET,
      date: new Date("2015-08-30T12:36:00Z"),
    });

    assert.equal(
      signed.canonicalRequest,
      [
        "GET",
        "/",
        "",
        "host:example.amazonaws.com",
        "x-amz-date:20150830T123600Z",
        "",
        "host;x-amz-date",
        EMPTY_PAYLOAD_HASH,
      ].join("\n"),
    );

    assert.equal(
      signed.stringToSign.split("\n").slice(0, 3).join("\n"),
      ["AWS4-HMAC-SHA256", "20150830T123600Z", "20150830/us-east-1/service/aws4_request"].join("\n"),
    );

    assert.equal(
      signed.signature,
      "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );

    assert.match(
      signed.headers.Authorization ?? "",
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20150830\/us-east-1\/service\/aws4_request, SignedHeaders=host;x-amz-date, Signature=/,
    );
  });
});

describe("de datumvorm", () => {
  it("is de vorm die x-amz-date verwacht", () => {
    assert.equal(toAmzDate(new Date("2015-08-30T12:36:00Z")), "20150830T123600Z");
    assert.equal(toAmzDate(new Date("2026-01-02T03:04:05.678Z")), "20260102T030405Z");
  });
});

/* -------------------------------------------------------------------------
 * De vorm van het adres
 * ---------------------------------------------------------------------- */

const base: StorageConfig = {
  bucket: "immoreel-media",
  region: "eu-west-1",
  accessKeyId: "x",
  secretAccessKey: "y",
  endpoint: null,
  forcePathStyle: false,
};

describe("waar een object staat", () => {
  it("zet de bucket bij Amazon in de hostnaam", () => {
    const { url, canonicalPath } = objectUrl(base, "ast_abc123.jpg");

    assert.equal(url.host, "immoreel-media.s3.eu-west-1.amazonaws.com");
    assert.equal(canonicalPath, "/ast_abc123.jpg");
  });

  it("zet de bucket bij een eigen endpoint in het pad", () => {
    const { url, canonicalPath } = objectUrl(
      { ...base, endpoint: "https://abc.r2.cloudflarestorage.com", forcePathStyle: true },
      "renders/job_1.mp4",
    );

    assert.equal(url.host, "abc.r2.cloudflarestorage.com");
    assert.equal(url.pathname, "/immoreel-media/renders/job_1.mp4");
    assert.equal(canonicalPath, "/immoreel-media/renders/job_1.mp4");
  });

  /**
   * Het pad in de URL en het pad in de handtekening moeten hetzelfde zijn.
   * Lopen ze uiteen, dan is het antwoord "SignatureDoesNotMatch" en zegt dat
   * niets over de oorzaak.
   */
  it("tekent hetzelfde pad als het ophaalt", () => {
    for (const config of [base, { ...base, endpoint: "https://s3.example", forcePathStyle: true }]) {
      const { url, canonicalPath } = objectUrl(config, "map/foto naam.jpg");

      assert.equal(url.pathname, canonicalPath);
    }
  });

  it("codeert een sleutel zonder de schuine strepen te slopen", () => {
    assert.equal(encodeStorageKey("map/foto naam.jpg"), "map/foto%20naam.jpg");
    assert.equal(encodeStorageKey("o'brien (1).jpg"), "o%27brien%20%281%29.jpg");
    assert.equal(encodeStorageKey("ast_abc.jpg"), "ast_abc.jpg");
  });
});
