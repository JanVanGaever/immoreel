/**
 * De stappen van de wizard, in volgorde. De voortgangsindicator, de koppen
 * boven elke stap en de knoppen onderaan lezen allemaal hieruit.
 */

export const WIZARD_STEP_IDS = ["naam", "doel", "formaat", "template", "fotos", "start"] as const;

export type WizardStepId = (typeof WIZARD_STEP_IDS)[number];

export type WizardStep = {
  id: WizardStepId;
  /** Kort, voor de voortgangsindicator. */
  label: string;
  /** Kop boven de stap zelf. */
  heading: string;
  intro: string;
};

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "naam",
    label: "Naam",
    heading: "Hoe noem je dit project?",
    intro: "Meestal het adres van het pand. Je kan de naam later nog wijzigen.",
  },
  {
    id: "doel",
    label: "Doel",
    heading: "Waar komt de video terecht?",
    intro: "We vullen meteen het formaat, het template en het tempo in dat daarbij past.",
  },
  {
    id: "formaat",
    label: "Formaat",
    heading: "In welke beeldverhouding?",
    intro: "Het voorstel hieronder komt van je doel. Iets anders kiezen mag altijd.",
  },
  {
    id: "template",
    label: "Template",
    heading: "Welk template gebruiken we?",
    intro: "Het template bepaalt intro, overgangen en waar de tekst staat.",
  },
  {
    id: "fotos",
    label: "Foto's",
    heading: "Voeg de foto's van het pand toe",
    intro: "De volgorde hieronder is de volgorde in de video; de eerste foto wordt de cover.",
  },
  {
    id: "start",
    label: "Klaar",
    heading: "Alles staat klaar",
    intro: "Controleer de keuzes en open het project in de editor.",
  },
];

export const STEP_COUNT = WIZARD_STEPS.length;

export function stepIndex(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((step) => step.id === id);
}

export function stepAt(index: number): WizardStep {
  return WIZARD_STEPS[Math.min(Math.max(index, 0), STEP_COUNT - 1)]!;
}

export function isLastStep(index: number): boolean {
  return index >= STEP_COUNT - 1;
}
