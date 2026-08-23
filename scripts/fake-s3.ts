import { createServer } from "node:http";

/**
 * Een nep-S3 om de opslagkoppeling tegenaan te draaien.
 *
 * Bewijst niet dat Amazon of R2 ons antwoord accepteert — dat kan alleen met een
 * echte bucket. Wat het wél doet: de hele keten van uploadroute tot
 * `/api/assets/:id` over een echte HTTP-verbinding laten lopen, en per verzoek
 * laten zien wat er over de lijn ging. Zonder dit blijft de koppeling iets dat
 * typecheckt maar nooit gedraaid heeft.
 *
 *   npx tsx scripts/fake-s3.ts [poort]
 */

const port = Number(process.argv[2] ?? 9999);
const objects = new Map<string, { body: Buffer; contentType: string }>();

const server = createServer((request, response) => {
  const key = decodeURIComponent(request.url ?? "/");
  const auth = request.headers.authorization ?? "";
  const chunks: Buffer[] = [];

  request.on("data", (chunk: Buffer) => chunks.push(chunk));

  request.on("end", () => {
    // Wat we willen zien: dat er een handtekening meekwam en waarover ze gaat.
    const signedHeaders = /SignedHeaders=([^,]+)/.exec(auth)?.[1] ?? "GEEN";
    const algorithm = auth.split(" ")[0] || "GEEN";

    console.log(
      JSON.stringify({
        method: request.method,
        key,
        algorithm,
        signedHeaders,
        contentSha: (request.headers["x-amz-content-sha256"] as string)?.slice(0, 16),
        bytes: Buffer.concat(chunks).length,
      }),
    );

    if (!auth.startsWith("AWS4-HMAC-SHA256")) {
      response.writeHead(403, { "content-type": "application/xml" });
      response.end("<Error><Code>AccessDenied</Code><Message>geen handtekening</Message></Error>");

      return;
    }

    if (request.method === "PUT") {
      objects.set(key, {
        body: Buffer.concat(chunks),
        contentType: (request.headers["content-type"] as string) ?? "application/octet-stream",
      });
      response.writeHead(200).end();

      return;
    }

    const object = objects.get(key);

    if (!object) {
      response.writeHead(404, { "content-type": "application/xml" });
      response.end("<Error><Code>NoSuchKey</Code><Message>niet gevonden</Message></Error>");

      return;
    }

    if (request.method === "HEAD") {
      response.writeHead(200, { "content-length": String(object.body.length) }).end();

      return;
    }

    response.writeHead(200, {
      "content-type": object.contentType,
      "content-length": String(object.body.length),
    });
    response.end(object.body);
  });
});

server.listen(port, "127.0.0.1", () => console.log(`nep-S3 luistert op ${port}`));
