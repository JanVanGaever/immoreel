import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createS3Client, StorageError } from "../src/lib/storage/s3";
import type { StorageConfig } from "../src/lib/storage/config";

/**
 * De S3-client, met een onderschepte `fetch`.
 *
 * Zonder bucket valt niet te bewijzen dát een bestand aankomt. Wat hier wél te
 * bewijzen is: dat we het juiste adres aanroepen, met de juiste methode, en met
 * een `Authorization` die over precies de kopregels gaat die we meesturen. Dat
 * zijn de dingen die stuk gaan als iemand hier iets verschuift, en de fout die
 * S3 er dan over teruggeeft ("SignatureDoesNotMatch") wijst nergens heen.
 */

const config: StorageConfig = {
  bucket: "immoreel-media",
  region: "eu-west-1",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  endpoint: "https://opslag.example",
  forcePathStyle: true,
};

type Opgevangen = { url: string; method: string; headers: Record<string, string> };

const echteFetch = globalThis.fetch;
let laatste: Opgevangen | null = null;

function onderschep(antwoord: () => Response): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};

    for (const [name, value] of new Headers(init?.headers).entries()) headers[name] = value;

    laatste = { url: String(input), method: init?.method ?? "GET", headers };

    return antwoord();
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = echteFetch;
  laatste = null;
});

describe("een bestand wegschrijven", () => {
  it("doet een PUT naar het volledige adres van het object", async () => {
    onderschep(() => new Response(null, { status: 200 }));

    const client = createS3Client(config);
    const stored = await client.put({
      key: "uploads/ast_abc.jpg",
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });

    assert.equal(laatste?.method, "PUT");
    assert.equal(laatste?.url, "https://opslag.example/immoreel-media/uploads/ast_abc.jpg");
    assert.equal(laatste?.headers["content-type"], "image/jpeg");
    assert.equal(stored.sizeInBytes, 3);
  });

  /**
   * Bytes worden meegetekend. Zonder deze kop kan iemand onderweg het lichaam
   * vervangen zonder dat de handtekening ongeldig wordt.
   */
  it("tekent de inhoud mee wanneer die in het geheugen zit", async () => {
    onderschep(() => new Response(null, { status: 200 }));

    await createS3Client(config).put({
      key: "k.jpg",
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });

    const hash = laatste?.headers["x-amz-content-sha256"];

    assert.notEqual(hash, "UNSIGNED-PAYLOAD");
    assert.match(hash ?? "", /^[0-9a-f]{64}$/);
  });

  /**
   * Een render van tweehonderd megabyte hoort niet eerst in het geheugen te
   * passen om gehasht te kunnen worden.
   */
  it("tekent een stroom niet mee, maar geeft wel de lengte door", async () => {
    onderschep(() => new Response(null, { status: 200 }));

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });

    const stored = await createS3Client(config).put({
      key: "renders/job.mp4",
      body: stream,
      contentType: "video/mp4",
      sizeInBytes: 1024,
    });

    assert.equal(laatste?.headers["x-amz-content-sha256"], "UNSIGNED-PAYLOAD");
    assert.equal(laatste?.headers["content-length"], "1024");
    assert.equal(stored.sizeInBytes, 1024);
  });

  it("ondertekent precies de kopregels die het meestuurt", async () => {
    onderschep(() => new Response(null, { status: 200 }));

    await createS3Client(config).put({
      key: "k.jpg",
      body: new Uint8Array([1]),
      contentType: "image/jpeg",
    });

    const auth = laatste?.headers.authorization ?? "";
    const signed = /SignedHeaders=([^,]+)/.exec(auth)?.[1]?.split(";") ?? [];

    assert.ok(signed.length > 0, `geen SignedHeaders in ${auth}`);

    for (const name of signed) {
      assert.ok(
        name in (laatste?.headers ?? {}),
        `${name} is ondertekend maar wordt niet meegestuurd`,
      );
    }

    assert.ok(signed.includes("host"));
    assert.ok(signed.includes("x-amz-content-sha256"));
    assert.match(auth, /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
  });
});

describe("een bestand ophalen", () => {
  it("geeft de stroom en de lengte terug", async () => {
    onderschep(
      () =>
        new Response("hallo", {
          status: 200,
          headers: { "content-type": "image/jpeg", "content-length": "5" },
        }),
    );

    const object = await createS3Client(config).get("uploads/ast_abc.jpg");

    assert.equal(object.contentType, "image/jpeg");
    assert.equal(object.sizeInBytes, 5);
    assert.equal(laatste?.method, "GET");
  });
});

describe("als het misgaat", () => {
  it("herkent een object dat er niet is", async () => {
    onderschep(
      () =>
        new Response("<Error><Code>NoSuchKey</Code><Message>weg</Message></Error>", { status: 404 }),
    );

    const error = await createS3Client(config)
      .get("weg.jpg")
      .catch((e: unknown) => e);

    assert.ok(error instanceof StorageError);
    assert.ok(error.isMissing);
    assert.ok(!error.isTransient);
    // De code van S3 hoort in de melding: 403 en 404 zien er in een logregel
    // anders identiek uit.
    assert.match(error.message, /NoSuchKey/);
  });

  it("herkent een hapering waarbij opnieuw proberen zin heeft", async () => {
    onderschep(() => new Response("<Error><Code>SlowDown</Code></Error>", { status: 503 }));

    const error = await createS3Client(config)
      .size("k.jpg")
      .catch((e: unknown) => e);

    assert.ok(error instanceof StorageError);
    assert.ok(error.isTransient);
    assert.ok(!error.isMissing);
  });

  it("geeft null bij een grootte van een object dat er niet is", async () => {
    onderschep(() => new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 }));

    assert.equal(await createS3Client(config).size("weg.jpg"), null);
  });
});

/* -------------------------------------------------------------------------
 * De uploadpoort erbovenop
 * ---------------------------------------------------------------------- */

describe("foto's in de bucket", () => {
  /**
   * Deze twee tests bestaan om een fout die er echt in zat.
   *
   * `put()` gaf eerst de sleutel mét map terug (`uploads/ast_x.jpg`), en die
   * ging zo de rij in. `open()` zette de map er dan nóg eens voor en struikelde
   * bovendien over de schuine streep in zijn eigen controle. Uploaden lukte,
   * terugkijken gaf "Deze opslaglocatie is onleesbaar" — en dat kwam pas aan het
   * licht toen de keten één keer echt over HTTP liep.
   *
   * De afspraak is nu: de rij bewaart `ast_x.jpg`, precies zoals bij de map op
   * schijf. De map in de bucket komt er alleen bij in het verkeer met S3.
   */
  function metOpslag<T>(run: () => Promise<T>): Promise<T> {
    const vorige = { ...process.env };

    Object.assign(process.env, {
      STORAGE_BUCKET: "immoreel-media",
      STORAGE_ACCESS_KEY_ID: "AKIDEXAMPLE",
      STORAGE_SECRET_ACCESS_KEY: "geheim",
      STORAGE_ENDPOINT: "https://opslag.example",
      STORAGE_REGION: "auto",
      STORAGE_FORCE_PATH_STYLE: "1",
      STORAGE_UPLOAD_PREFIX: "uploads",
    });

    return run().finally(() => {
      for (const key of Object.keys(process.env)) {
        if (!(key in vorige)) delete process.env[key];
      }
      Object.assign(process.env, vorige);
    });
  }

  it("bewaart de sleutel zonder de map van de bucket", async () => {
    await metOpslag(async () => {
      onderschep(() => new Response(null, { status: 200 }));

      const { createS3UploadStorage } = await import("../src/lib/uploads/storage");
      const stored = await createS3UploadStorage().put({
        assetId: "ast_abc123",
        fileName: "gevel.jpg",
        contentType: "image/jpeg",
        data: new Uint8Array([1, 2, 3]),
      });

      assert.equal(stored.key, "ast_abc123.jpg", "de map hoort niet in de rij terecht te komen");
      assert.ok(!stored.key.includes("/"), `sleutel bevat een pad: ${stored.key}`);
      assert.equal(laatste?.url, "https://opslag.example/immoreel-media/uploads/ast_abc123.jpg");
    });
  });

  it("haalt met diezelfde sleutel hetzelfde object weer op", async () => {
    await metOpslag(async () => {
      onderschep(
        () => new Response("bytes", { status: 200, headers: { "content-length": "5" } }),
      );

      const { createS3UploadStorage } = await import("../src/lib/uploads/storage");
      const output = await createS3UploadStorage().open("ast_abc123.jpg", "image/jpeg");

      assert.equal(laatste?.url, "https://opslag.example/immoreel-media/uploads/ast_abc123.jpg");
      assert.ok(!laatste?.url.includes("uploads/uploads"), "de map staat er dubbel voor");
      // Wat wij van de asset weten wint van wat de bucket zegt.
      assert.equal(output.contentType, "image/jpeg");
    });
  });
});
