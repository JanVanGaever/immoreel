import { DEFAULT_MOTION, presetMotion } from "@/lib/editor/motion";
import type { ID, MotionKind, SceneMotion } from "@/types";

/**
 * Wat een template in de editor betekent.
 *
 * De catalogus zelf staat in `src/db/template-store.ts` — daar horen naam,
 * beschrijving en de beeldverhoudingen die een template aankan. Hier staat
 * alleen wat de editor ermee doet: welke scènelengte en beweging erbij horen,
 * hoe lang de intro en outro duren en hoe de overgang eruitziet.
 *
 * De koppeling loopt via het template-id. Staat een template hier niet in,
 * dan geldt `FALLBACK_TEMPLATE_STYLE`; een nieuw template in de catalogus
 * werkt dus meteen, en wordt beter zodra het hier ook een stijl krijgt.
 */

export type TransitionId = "hard" | "crossfade" | "dip-to-black" | "schuif";

export type TransitionOption = {
  id: TransitionId;
  label: string;
  description: string;
  /** Overlap tussen twee scènes; telt af van de totale duur. */
  durationInSeconds: number;
};

export const TRANSITION_OPTIONS: TransitionOption[] = [
  {
    id: "hard",
    label: "Harde cut",
    description: "Geen overgang. Kort en energiek.",
    durationInSeconds: 0,
  },
  {
    id: "crossfade",
    label: "Crossfade",
    description: "Beelden lopen even door elkaar. De rustigste overgang.",
    durationInSeconds: 0.5,
  },
  {
    id: "dip-to-black",
    label: "Via zwart",
    description: "Kort door zwart. Markeert een nieuwe ruimte.",
    durationInSeconds: 0.6,
  },
  {
    id: "schuif",
    label: "Schuiven",
    description: "Het volgende beeld duwt het vorige weg.",
    durationInSeconds: 0.4,
  },
];

export function getTransition(id: TransitionId): TransitionOption {
  return TRANSITION_OPTIONS.find((option) => option.id === id) ?? TRANSITION_OPTIONS[1]!;
}

export type TemplateStyle = {
  /** Standaardlengte van een nieuwe scène. */
  secondsPerPhoto: number;
  /** Beweging die nieuwe scènes krijgen. */
  motion: SceneMotion;
  transition: TransitionId;
  introSeconds: number;
  outroSeconds: number;
  /** Bewegingen die bij dit template niet passen; blijven wel instelbaar. */
  discouragedMotion?: MotionKind[];
};

export const FALLBACK_TEMPLATE_STYLE: TemplateStyle = {
  secondsPerPhoto: 3,
  motion: DEFAULT_MOTION,
  transition: "crossfade",
  introSeconds: 2,
  outroSeconds: 2,
};

export const TEMPLATE_STYLES: Record<ID, TemplateStyle> = {
  tpl_klassiek: {
    secondsPerPhoto: 4,
    motion: presetMotion("zoom-in"),
    transition: "crossfade",
    introSeconds: 2,
    outroSeconds: 2.5,
  },
  tpl_dynamisch: {
    secondsPerPhoto: 2.5,
    motion: presetMotion("ken-burns", { focusY: 0.45 }),
    transition: "schuif",
    introSeconds: 1.5,
    outroSeconds: 2,
  },
  tpl_zakelijk: {
    secondsPerPhoto: 3.5,
    motion: presetMotion("pan-right"),
    transition: "dip-to-black",
    introSeconds: 2.5,
    outroSeconds: 3,
    discouragedMotion: ["ken-burns"],
  },
  tpl_snel: {
    secondsPerPhoto: 2,
    // Bewust geen preset: "Snel & kort" hoort er ook zo uit te zien.
    motion: presetMotion("zoom-in", { intensity: 0.55, speed: 1.3, easing: "eind-traag" }),
    transition: "hard",
    introSeconds: 1,
    outroSeconds: 1.5,
  },
  tpl_luxe: {
    secondsPerPhoto: 5,
    motion: presetMotion("slow-zoom"),
    transition: "crossfade",
    introSeconds: 3,
    outroSeconds: 3,
    discouragedMotion: ["ken-burns", "geen"],
  },
};

export function templateStyle(templateId: ID | null | undefined): TemplateStyle {
  if (!templateId) return FALLBACK_TEMPLATE_STYLE;

  return TEMPLATE_STYLES[templateId] ?? FALLBACK_TEMPLATE_STYLE;
}
