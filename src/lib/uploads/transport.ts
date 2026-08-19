import type { ID, UploadAsset, UploadOrderEntry } from "@/types";

/**
 * De poort naar de opslag.
 *
 * De uploadcomponenten weten niet waar een bestand heen gaat: ze krijgen een
 * `UploadTransport` mee en melden voortgang, fouten en annulering door. Zolang
 * er nog geen object storage is, draait de app op `createFakeTransport`; de
 * dag dat de backend er staat, wissel je die om voor `createXhrTransport`
 * zonder dat er aan een component iets verandert.
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
          reject(new Error(errorMessageForStatus(request.status)));
          return;
        }

        onProgress(100);
        resolve(parseResponse(request.responseText));
      });

      request.addEventListener("error", () => reject(new Error("Geen verbinding met de server.")));
      request.addEventListener("timeout", () => reject(new Error("De upload duurde te lang.")));

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
          reject(new Error("De opslag antwoordde niet."));
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

function errorMessageForStatus(status: number): string {
  if (status === 413) return "Dit bestand is te groot voor de server.";
  if (status === 401 || status === 403) return "Je hebt geen toestemming om te uploaden.";
  if (status === 0) return "De verbinding viel weg.";

  return `De server gaf een fout (${status}).`;
}
