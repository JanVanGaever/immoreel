import { Briefcase, Camera, Globe, MessageCircle, Music2, type LucideIcon } from "lucide-react";
import type { AspectRatio, ID, ProjectGoal } from "@/types";

/**
 * De presets achter stap 2. Een doel kiezen vult meteen formaat, template en
 * scènelengte in — dat is wat de wizard kort houdt. De gebruiker kan elke
 * waarde daarna nog wijzigen; een preset overschrijft nooit een eigen keuze
 * (zie `choseAspectRatio` en `choseTemplate` in `ProjectDraft`).
 */

export type GoalPreset = {
  aspectRatio: AspectRatio;
  /**
   * Template dat standaard aangevinkt wordt. Bestaat het niet (meer) in de
   * catalogus, dan valt `resolveTemplateId()` terug op het eerste template
   * dat bij het formaat past.
   */
  templateId: ID;
  /**
   * Hoe lang elke foto in beeld blijft, staat hier bewust *niet*. Dat komt uit
   * het template (`templateStyle().secondsPerPhoto`), want dat is ook waar de
   * editor het vandaan haalt voor elke foto die er later bij komt. Toen het op
   * twee plekken stond, liepen ze uit elkaar: LinkedIn beloofde 3 seconden en
   * "Zakelijk" maakte er 3,5 van, en WhatsApp 3 tegenover 4.
   */
  /** Richtlijn in de fotostap; geen harde grens. */
  recommendedPhotos: number;
};

export type GoalOption = {
  id: ProjectGoal;
  label: string;
  description: string;
  icon: LucideIcon;
  preset: GoalPreset;
};

export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "website",
    label: "Website",
    description: "Op je eigen zoekertje of in een e-mail naar kandidaat-kopers.",
    icon: Globe,
    preset: {
      aspectRatio: "16:9",
      templateId: "tpl_klassiek",
      recommendedPhotos: 14,
    },
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Zakelijke tijdlijn: sober, met je logo en contactgegevens.",
    icon: Briefcase,
    preset: {
      aspectRatio: "1:1",
      templateId: "tpl_zakelijk",
      recommendedPhotos: 10,
    },
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "Reels en verhalen: staand beeld met vlotte overgangen.",
    icon: Camera,
    preset: {
      aspectRatio: "9:16",
      templateId: "tpl_dynamisch",
      recommendedPhotos: 10,
    },
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "Kort en snel; de eerste seconden moeten het werk doen.",
    icon: Music2,
    preset: {
      aspectRatio: "9:16",
      templateId: "tpl_snel",
      recommendedPhotos: 8,
    },
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Rechtstreeks naar een kandidaat sturen; klein en kort.",
    icon: MessageCircle,
    preset: {
      aspectRatio: "9:16",
      templateId: "tpl_klassiek",
      recommendedPhotos: 8,
    },
  },
];

const GOALS_BY_ID = new Map(GOAL_OPTIONS.map((option) => [option.id, option]));

export function getGoal(goal: ProjectGoal): GoalOption {
  const option = GOALS_BY_ID.get(goal);
  if (!option) throw new Error(`Onbekend doel: ${goal}`);

  return option;
}

export const GOAL_LABELS: Record<ProjectGoal, string> = {
  website: "Website",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export function isProjectGoal(value: unknown): value is ProjectGoal {
  return typeof value === "string" && GOALS_BY_ID.has(value as ProjectGoal);
}
