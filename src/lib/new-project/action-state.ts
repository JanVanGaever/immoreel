import type { DraftErrors } from "@/lib/new-project/validation";

/**
 * Wat de wizard terugkrijgt van `createProjectAction`. Staat los van
 * `actions.ts`, omdat een "use server"-bestand alleen async functies mag
 * exporteren. Bij succes komt er niets terug: de actie stuurt door naar de
 * editor.
 */
export type NewProjectActionState = {
  status: "idle" | "error";
  /** Melding over het geheel, boven de knoppen. */
  message?: string;
  /** Meldingen per veld; de wizard springt naar de stap die erbij hoort. */
  fieldErrors?: DraftErrors;
};

export const initialNewProjectState: NewProjectActionState = { status: "idle" };
