import { resolveBrand } from "@/lib/brand/kit";
import { buildTimeline, findScene, type EditorDocument } from "@/lib/editor/document";
import { normaliseMotion } from "@/lib/editor/motion";
import { getTransition, templateStyle, type TransitionId } from "@/lib/editor/templates";
import type { AspectRatio, ID, LogoPlacement, ResolvedBrand, SceneMotion } from "@/types";

/**
 * Wat de previewspeler afspeelt.
 *
 * Dit is de tegenhanger van `buildRenderPlan()`: dezelfde tijdlijn, maar
 * vertaald naar wat de browser aankan in plaats van naar FFmpeg-filters. Waar
 * het renderplan in frames en `zoompan`-expressies denkt, denkt dit in slides
 * met een beeld, een beweging en een overgang.
 *
 * Het is met opzet een *plan* en geen live afgeleide van het document. De
 * speler leest alleen dit plan, dus wat er in beeld staat blijft één geheel:
 * een instelling die halverwege wijzigt verandert niet stiekem de scène die op
 * dat moment loopt. In plaats daarvan wordt er een nieuw plan gebouwd en begint
 * de preview opnieuw (zie `usePreviewPlan`).
 *
 * De preview is een benadering en zegt dat ook: lage resolutie, overgangen in
 * CSS in plaats van `xfade`, geen geluid. De beweging is dat níet — die komt
 * uit dezelfde `motionStyleAt()` als de render.
 */

/* -------------------------------------------------------------------------
 * Formaat
 * ---------------------------------------------------------------------- */

/**
 * De lange zijde van het previewbeeld in pixels. 480 is klein genoeg om een
 * foto van twaalf megapixel in enkele milliseconden te verkleinen, en groot
 * genoeg om te zien of een bijschrift leesbaar blijft.
 */
export const PREVIEW_LONG_EDGE = 480;

/**
 * Hoeveel groter de verkleinde foto is dan het kader. De beweging zoomt tot
 * ongeveer 1,4× in; zonder overschot wordt juist het stuk waar de camera
 * naartoe gaat het zachtst.
 */
export const PREVIEW_OVERSAMPLE = 1.5;

/** JPEG-kwaliteit van de verkleinde foto. */
export const PREVIEW_QUALITY = 0.72;

/**
 * Het beeldritme van de preview. De export draait op 30 beelden per seconde;
 * de preview op 24, en dat is niet alleen zuinig — het is ook eerlijker. Een
 * preview die op de kloksnelheid van het scherm loopt, oogt vloeiender dan de
 * video ooit wordt. Wie hier beoordeelt of een pan rustig genoeg is, kijkt
 * liever naar iets wat een tikje minder vloeiend is dan het eindresultaat dan
 * naar iets wat vloeiender is.
 */
export const PREVIEW_FPS = 24;

export type PreviewSize = { width: number; height: number };

/** Het previewkader in pixels, met de lange zijde op `PREVIEW_LONG_EDGE`. */
export function previewFrameSize(aspectRatio: AspectRatio): PreviewSize {
  const [w = 16, h = 9] = aspectRatio.split(":").map(Number);
  const scale = PREVIEW_LONG_EDGE / Math.max(w, h);

  // Even getallen: een oneven pixelmaat geeft een halve pixel bij het schalen.
  const round = (value: number) => Math.max(Math.round((value * scale) / 2) * 2, 2);

  return { width: round(w), height: round(h) };
}

/* -------------------------------------------------------------------------
 * Het plan
 * ---------------------------------------------------------------------- */

export type PreviewSlideKind = "intro" | "scene" | "outro";

/** Het beeld van een slide; ontbreekt bij een titel- of contactkaart. */
export type PreviewPhoto = {
  /** De bron-URL zoals de editor ze kent (meestal een blob-URL). */
  url: string;
  fileName: string;
};

export type PreviewSlide = {
  id: ID;
  kind: PreviewSlideKind;
  sceneId: ID | null;
  /** Zoals de gebruiker telt: slide 1 is de eerste, ook als dat de intro is. */
  number: number;
  label: string;
  startInSeconds: number;
  durationInSeconds: number;
  motion: SceneMotion;
  transition: TransitionId;
  /** Overlap met de vorige slide; 0 bij de eerste en bij een harde cut. */
  transitionInSeconds: number;
  photo: PreviewPhoto | null;
  captionTop: string | null;
  captionBottom: string | null;
  /** Het prijsblok ligt alleen over de eerste foto. */
  showPriceBadge: boolean;
};

/**
 * De huisstijl zoals de preview ze nodig heeft: de kit van het kantoor en de
 * afwijkingen van dit project al over elkaar gelegd, kleuren al berekend. Zo
 * hoeft er tijdens het afspelen niets meer uitgezocht te worden — vierentwintig
 * keer per seconde een contrastverhouding uitrekenen is werk dat hier één keer
 * gebeurt.
 */
export type PreviewBranding = {
  title: string;
  brand: ResolvedBrand;
  logoPlacement: LogoPlacement;
};

export type PreviewPlan = {
  aspectRatio: AspectRatio;
  branding: PreviewBranding;
  /** Het previewkader in pixels — bewust niet de exportresolutie. */
  size: PreviewSize;
  durationInSeconds: number;
  slides: PreviewSlide[];
  /** Elke foto één keer, in de volgorde waarin ze voorkomt. */
  photoUrls: string[];
  /** Foto's waarvan de upload nog loopt of mislukt is. */
  missingPhotos: number;
  /**
   * Verandert deze waarde, dan is de preview verouderd. De speler begint
   * daarop opnieuw; het is de enige vergelijking die daarvoor nodig is.
   */
  signature: string;
};

export function buildPreviewPlan(document: EditorDocument): PreviewPlan {
  const timeline = buildTimeline(document);
  const style = templateStyle(document.templateId);
  const size = previewFrameSize(document.aspectRatio);

  const slides: PreviewSlide[] = timeline.segments.map((segment, index) => {
    const scene = findScene(document, segment.sceneId);

    // De overgang van deze scène, niet die van het project. Hier stond eerder
    // één waarde voor alle slides, met een terugval op het template zodra de
    // scènes van elkaar verschilden — waardoor het aanpassen van één overgang
    // in de preview niets deed terwijl de render hem wél gebruikte.
    const transition = (scene?.transition as TransitionId | null) ?? style.transition;

    return {
      id: segment.id,
      kind: segment.kind,
      sceneId: segment.sceneId,
      number: index + 1,
      label: segment.label,
      startInSeconds: segment.startInSeconds,
      durationInSeconds: segment.durationInSeconds,
      motion: scene ? normaliseMotion(scene.motion) : STILL_MOTION,
      transition,
      // De eerste slide heeft niets om overheen te lopen.
      transitionInSeconds: index === 0 ? 0 : getTransition(transition).durationInSeconds,
      photo: scene?.source.previewUrl
        ? { url: scene.source.previewUrl, fileName: scene.source.fileName }
        : null,
      captionTop: scene?.captionTop ?? null,
      captionBottom: scene?.captionBottom ?? null,
      showPriceBadge: document.branding.showPriceBadge && scene?.order === 0,
    };
  });

  const brand = resolveBrand(document.brand, document.branding);

  return {
    aspectRatio: document.aspectRatio,
    branding: {
      title: document.title,
      brand,
      logoPlacement: brand.showWatermark ? document.branding.logoPlacement : "geen",
    },
    size,
    durationInSeconds: timeline.durationInSeconds,
    slides,
    photoUrls: [...new Set(slides.flatMap((slide) => (slide.photo ? [slide.photo.url] : [])))],
    missingPhotos: document.scenes.filter((scene) => scene.source.status !== "klaar").length,
    signature: previewSignature(document),
  };
}

/** Titelkaarten bewegen niet: dat is tekst, geen foto. */
const STILL_MOTION: SceneMotion = {
  kind: "geen",
  intensity: 0,
  speed: 1,
  easing: "lineair",
  focusX: 0.5,
  focusY: 0.5,
};

/* -------------------------------------------------------------------------
 * Wanneer de preview verouderd is
 * ---------------------------------------------------------------------- */

/**
 * Alles wat het beeld bepaalt, als één tekst.
 *
 * Bewust niet het hele document: welke scène geselecteerd staat verandert
 * niets aan de video, en zou de preview dus ook niet mogen laten herbeginnen.
 */
export function previewSignature(document: EditorDocument): string {
  return JSON.stringify([
    document.title,
    document.aspectRatio,
    document.templateId,
    document.branding,
    document.audio.trackId,
    document.scenes.map((scene) => [
      scene.id,
      scene.durationInSeconds,
      scene.motion,
      scene.transition,
      scene.captionTop,
      scene.captionBottom,
      scene.source.previewUrl,
      scene.source.status,
    ]),
  ]);
}

/**
 * Alleen wat de verkleinde foto's bepaalt: welke beelden, en in welk kader.
 * Een duur of een bijschrift wijzigen hoeft geen enkele foto opnieuw te
 * verkleinen — en dat is de zwaarste stap van het opbouwen.
 */
export function previewPhotoSignature(plan: PreviewPlan): string {
  return JSON.stringify([plan.size.width, plan.size.height, plan.photoUrls]);
}

/* -------------------------------------------------------------------------
 * Uitlezen tijdens het afspelen
 * ---------------------------------------------------------------------- */

export type PreviewFrame = {
  /** Positie van `slide` in `plan.slides`; -1 als er nog niets is. */
  index: number;
  slide: PreviewSlide | null;
  /** Hoever de slide staat, van 0 tot 1. */
  progress: number;
  /** De slide die er tijdens een overgang nog onder wegloopt. */
  outgoing: PreviewSlide | null;
  outgoingProgress: number;
  /** 0 bij het begin van de overgang, 1 zodra ze klaar is. */
  transitionProgress: number;
};

const EMPTY_FRAME: PreviewFrame = {
  index: -1,
  slide: null,
  progress: 0,
  outgoing: null,
  outgoingProgress: 0,
  transitionProgress: 1,
};

/** Wat er op dit moment in beeld staat: de bovenste slide, en wat eronder ligt. */
export function previewFrameAt(plan: PreviewPlan, timeInSeconds: number): PreviewFrame {
  if (plan.slides.length === 0) return EMPTY_FRAME;

  // De laatste slide die al begonnen is ligt bovenop; vóór de eerste staan we
  // op het openingsbeeld.
  let index = 0;
  for (let i = plan.slides.length - 1; i >= 0; i -= 1) {
    if (timeInSeconds >= plan.slides[i]!.startInSeconds) {
      index = i;
      break;
    }
  }

  const slide = plan.slides[index]!;
  const previous = index > 0 ? (plan.slides[index - 1] ?? null) : null;
  const elapsed = timeInSeconds - slide.startInSeconds;

  const transitionProgress =
    slide.transitionInSeconds > 0 ? clamp01(elapsed / slide.transitionInSeconds) : 1;
  const isCrossing = previous !== null && transitionProgress < 1;

  return {
    index,
    slide,
    progress: progressOf(slide, timeInSeconds),
    outgoing: isCrossing ? previous : null,
    outgoingProgress: isCrossing ? progressOf(previous, timeInSeconds) : 0,
    transitionProgress,
  };
}

function progressOf(slide: PreviewSlide, timeInSeconds: number): number {
  if (slide.durationInSeconds <= 0) return 0;

  return clamp01((timeInSeconds - slide.startInSeconds) / slide.durationInSeconds);
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/* -------------------------------------------------------------------------
 * Overgangen
 * ---------------------------------------------------------------------- */

export type PreviewLayerStyle = {
  opacity: number;
  /** Verschuiving als fractie van de breedte; 0 is op zijn plaats. */
  translateX: number;
};

export type PreviewTransitionStyle = {
  incoming: PreviewLayerStyle;
  outgoing: PreviewLayerStyle;
};

/**
 * De overgang als twee lagen, halverwege.
 *
 * FFmpeg doet dit straks met `xfade`, per pixel. Hier is het opacity en een
 * verschuiving: dezelfde timing en dezelfde volgorde, ander rekenwerk. Voor
 * "voelt dit goed?" is dat genoeg; voor "is dit exact het eindresultaat?" is
 * de render er.
 */
export function transitionStyleAt(
  transition: TransitionId,
  progress: number,
): PreviewTransitionStyle {
  const t = clamp01(progress);

  switch (transition) {
    case "hard":
      return { incoming: { opacity: 1, translateX: 0 }, outgoing: { opacity: 0, translateX: 0 } };

    case "crossfade":
      return { incoming: { opacity: t, translateX: 0 }, outgoing: { opacity: 1, translateX: 0 } };

    case "dip-to-black":
      // Eerst weg naar zwart, dan pas het nieuwe beeld erop. De achtergrond van
      // het kader ís zwart, dus er hoeft geen laag tussen.
      return {
        incoming: { opacity: Math.max(0, t * 2 - 1), translateX: 0 },
        outgoing: { opacity: Math.max(0, 1 - t * 2), translateX: 0 },
      };

    case "schuif":
      // Het nieuwe beeld duwt; het oude geeft mee, maar minder ver — dat leest
      // als diepte in plaats van als één plaat die opzijglijdt.
      return {
        incoming: { opacity: 1, translateX: 1 - t },
        outgoing: { opacity: 1, translateX: -0.25 * t },
      };
  }
}
