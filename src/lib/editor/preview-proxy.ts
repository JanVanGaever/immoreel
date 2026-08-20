import { PREVIEW_OVERSAMPLE, PREVIEW_QUALITY, type PreviewSize } from "@/lib/editor/preview-plan";

/**
 * De foto's verkleinen tot previewformaat.
 *
 * Een makelaarsfoto is al gauw twaalf megapixel. Vier zulke beelden tegelijk in
 * beweging houden laat elke browser haperen — en juist haperen is wat de
 * preview onbruikbaar maakt: je kan dan niet meer beoordelen of een beweging
 * rustig genoeg is, want je ziet de beweging niet meer.
 *
 * Daarom draait de speler niet op de originelen maar op een kopie van een paar
 * honderd pixels breed, één keer gemaakt en daarna hergebruikt. Dat is meteen
 * de reden dat de preview een laadmoment heeft: dit is echt werk, en het is de
 * enige stap tussen "iets gewijzigd" en "opnieuw afspelen".
 *
 * De kopieën zijn blob-URL's en moeten dus vrijgegeven worden; `usePreviewPlan`
 * doet dat zodra een set niet meer in beeld komt.
 */

export type PreviewProxy = {
  /** Blob-URL van de verkleinde foto, of de bron zelf als verkleinen niet lukte. */
  url: string;
  /** `false` als we op het origineel zijn teruggevallen. */
  isScaled: boolean;
  width: number;
  height: number;
};

/** Foto's die niet verkleind konden worden, op bron-URL. */
export type PreviewProxyMap = Map<string, PreviewProxy>;

export type CreateProxyOptions = {
  /** Het kader waar de foto in moet passen. */
  frame: PreviewSize;
  /** Afbreken zodra er een nieuw plan is; halfaf werk heeft geen waarde meer. */
  signal?: AbortSignal;
};

/**
 * Eén foto verkleinen. Er wordt nooit vergroot: een kleine foto blijft zoals
 * ze is, want opblazen kost geheugen en levert geen enkel detail op.
 */
export async function createPreviewProxy(
  sourceUrl: string,
  { frame, signal }: CreateProxyOptions,
): Promise<PreviewProxy> {
  const image = await loadImage(sourceUrl, signal);
  const width = image.naturalWidth || frame.width;
  const height = image.naturalHeight || frame.height;

  // De foto wordt bijgesneden tot het kader (`object-fit: cover`), dus beide
  // zijden moeten het kader halen. De grootste van de twee verhoudingen wint.
  const cover = Math.max((frame.width * PREVIEW_OVERSAMPLE) / width, (frame.height * PREVIEW_OVERSAMPLE) / height);
  const scale = Math.min(cover, 1);

  const target = {
    width: Math.max(Math.round(width * scale), 1),
    height: Math.max(Math.round(height * scale), 1),
  };

  const original: PreviewProxy = { url: sourceUrl, isScaled: false, width, height };
  if (scale >= 1) return original;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;

    const context = canvas.getContext("2d");
    if (!context) return original;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, target.width, target.height);

    const blob = await toBlob(canvas);
    if (!blob || signal?.aborted) return original;

    return { url: URL.createObjectURL(blob), isScaled: true, width: target.width, height: target.height };
  } catch {
    // Een foto van een ander domein zonder CORS maakt het canvas onbruikbaar.
    // De preview blijft dan werken, alleen op het origineel.
    return original;
  }
}

/** De blob-URL's vrijgeven; op het origineel mag dat niet, dat is niet van ons. */
export function revokePreviewProxies(proxies: Iterable<PreviewProxy>): void {
  for (const proxy of proxies) {
    if (proxy.isScaled) URL.revokeObjectURL(proxy.url);
  }
}

function loadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Preview afgebroken.", "AbortError"));
      return;
    }

    const image = new Image();
    // Zonder decoderen zou de eerste beweging alsnog op het hoofdproces vallen.
    image.decoding = "async";

    const stop = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      stop();
      image.src = "";
      reject(new DOMException("Preview afgebroken.", "AbortError"));
    };

    image.onload = () => {
      stop();
      resolve(image);
    };
    image.onerror = () => {
      stop();
      reject(new Error(`Foto kon niet geladen worden: ${url}`));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", PREVIEW_QUALITY);
  });
}
