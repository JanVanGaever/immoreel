import { AppError } from "@/lib/errors/app-error";
import { codeForStatus } from "@/lib/errors/catalogue";
import { readErrorEnvelope } from "@/lib/errors/normalize";
import type { ID, UploadAsset, UploadOrderEntry } from "@/types";

/**
 * De poort naar de opslag.
 *
 * De uploadcomponenten weten niet waar een bestand heen gaat: ze krijgen een
 * `UploadTransport` mee en melden voortgang, fouten en annulering door. Zolang
 * er nog geen object storage is, draait de app op `createFakeTransport`; de
 * dag dat de backend er staat, wissel je die om voor `createXhrTransport`
 * zonder dat er aan een component iets verandert.
 *
 * **Wat een transport gooit, is een `AppError`** (`src/lib/errors`). Niet uit
 * netheid: de uploadlijst beslist op de code of ze het zelf nog eens probeert.
 * Een bestand dat te groot is (`too-large`) blijft te groot, hoe vaak je ook
 * herbegint; een verbinding die wegviel (`network`) is bij de tweede poging
 * vaak weer terug. Met een kale `Error` is dat verschil niet te maken, en dan
 * krijgt de gebruiker drie keer dezelfde melding met drie keer dezelfde wacht.
 */

export type UploadContext = {
  file: File;
  /** Het id van de asset in de lijst; handig als correlatie-id richting de server. */
  assetId: ID;
  /** Wordt afgebroken bij annuleren of verwijderen tijdens de upload. */
  signal: AbortSignal;
  /** Percentage tussen 0 en 100. */
  onProgress: (percentage: number) => void;
};

/** Wat de server teruggeeft zodra het bestand binnen is. */
export type UploadResult = {
  remoteId?: ID;
  url?: string;
};

export type UploadTransport = (context: UploadContext) => Promise<UploadResult>;

export type XhrTransportOptions = {
  /** Bijvoorbeeld `/api/uploads`. */
  endpoint: string;
  /** Veldnaam in de multipart body. */
  fieldName?: string;
  headers?: Record<string, string>;
  /** Extra velden die met elk bestand meegaan, bijvoorbeeld het projectid. */
  fields?: Record<string, string>;
  withCredentials?: boolean;
};

/**
 * Upload via `XMLHttpRequest`. Dat is hier geen nostalgie: `fetch` geeft geen
 * voortgang van een request body, en zonder voortgang is een uploadbalk een
 * animatie die niets betekent.
 */
export function createXhrTransport({
  endpoint,
  fieldName = "file",
  headers,
  fields,
  withCredentials = true,
}: XhrTransportOptions): UploadTransport {
  return ({ file, assetId, signal, onProgress }) =>
    new Promise<UploadResult>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Upload geannuleerd.", "AbortError"));
        return;
      }

      const request = new XMLHttpRequest();
      const body = new FormData();

      body.append(fieldName, file, file.name);
      body.append("assetId", assetId);
      for (const [key, value] of Object.entries(fields ?? {})) body.append(key, value);

      request.open("POST", endpoint);
      request.withCredentials = withCredentials;
      for (const [key, value] of Object.entries(headers ?? {})) request.setRequestHeader(key, value);

      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
      });

      request.addEventListener("load", () => {
        if (request.status < 200 || request.status >= 300) {
          reject(errorForResponse(request));
          return;
        }

        onProgress(100);
        resolve(parseResponse(request.responseText));
      });

      request.addEventListener("error", () =>
        reject(
          new AppError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "network", {
            detail: `XHR error op ${endpoint}`,
            context: { fileName: file.name },
          }),
        ),
      );

      request.addEventListener("timeout", () =>
        reject(new AppError("timeout", { detail: `XHR timeout op ${endpoint}` })),
      );

      signal.addEventListener("abort", () => request.abort(), { once: true });

      request.send(body);
    });
}

/**
 * Upload die niets verstuurt maar wel de tijd neemt, met voortgang die van de
 * bestandsgrootte afhangt. Hiermee is het scherm compleet te gebruiken en te
 * testen zolang de opslag er nog niet is.
 */
export function createFakeTransport(options: { bytesPerSecond?: number; failEvery?: number } = {}): UploadTransport {
  const { bytesPerSecond = 3 * 1024 * 1024, failEvery = 0 } = options;
  let count = 0;

  return ({ file, assetId, signal, onProgress }) =>
    new Promise<UploadResult>((resolve, reject) => {
      const index = ++count;
      const durationMs = Math.min(Math.max((file.size / bytesPerSecond) * 1000, 700), 8000);
      const startedAt = Date.now();

      const timer = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const percentage = Math.min((elapsed / durationMs) * 100, 100);

        onProgress(percentage);

        if (percentage < 100) return;

        stop();

        if (failEvery > 0 && index % failEvery === 0) {
          reject(new AppError("storage", { domain: "upload", detail: "Nagebootste fout." }));
        } else {
          resolve({ remoteId: `ast_${assetId.slice(-8)}` });
        }
      }, 120);

      function stop() {
        clearInterval(timer);
        signal.removeEventListener("abort", onAbort);
      }

      function onAbort() {
        stop();
        reject(new DOMException("Upload geannuleerd.", "AbortError"));
      }

      signal.addEventListener("abort", onAbort, { once: true });
    });
}

/**
 * De volgorde zoals de gebruiker ze gelegd heeft, klaar om te bewaren. Stuur
 * dit na een reorder naar de server; de lijst zelf blijft de bron.
 */
export function toUploadOrder(assets: UploadAsset[]): UploadOrderEntry[] {
  return assets.map((asset, index) => ({
    assetId: asset.id,
    remoteId: asset.remoteId ?? null,
    position: index,
  }));
}

/** JSON als het JSON is, en anders niets. Een kapot antwoord is geen tweede fout. */
function parseJson(responseText: string): unknown {
  if (!responseText) return undefined;

  try {
    return JSON.parse(responseText);
  } catch {
    return undefined;
  }
}

function parseResponse(responseText: string): UploadResult {
  if (!responseText) return {};

  try {
    const payload: unknown = JSON.parse(responseText);
    if (!payload || typeof payload !== "object") return {};

    const { id, assetId, url } = payload as Record<string, unknown>;
    const remoteId = typeof id === "string" ? id : typeof assetId === "string" ? assetId : undefined;

    return { remoteId, url: typeof url === "string" ? url : undefined };
  } catch {
    // Een antwoord dat geen JSON is, betekent niet dat de upload mislukt is.
    return {};
  }
}

/**
 * De fout die bij dit antwoord hoort.
 *
 * De foutenvelop van onze eigen API (`{ error: { code, message } }`) wint als
 * ze er is: die weet preciezer wat er misging dan de statuscode. Staat er niets
 * bruikbaar in — een proxy, een opslag die niet van ons is — dan valt het terug
 * op de status.
 */
function errorForResponse(request: XMLHttpRequest): AppError {
  const status = request.status;

  // Status 0 betekent dat er nooit een antwoord kwam: de verbinding viel weg.
  if (status === 0) return new AppError("network", { detail: "XHR zonder antwoord (status 0)." });

  const envelope = readErrorEnvelope(parseJson(request.responseText));

  return new AppError(envelope?.code ?? codeForStatus(status), {
    message: envelope?.message,
    detail: `HTTP ${status} bij het uploaden.`,
    context: { status },
  });
}
