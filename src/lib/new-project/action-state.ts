import type { ID } from "@/types";
import type { DraftErrors } from "@/lib/new-project/validation";

/**
 * Wat de wizard terugkrijgt van `createProjectAction`. Staat los van
 * `actions.ts`, omdat een "use server"-bestand alleen async functies mag
 * exporteren.
 *
 * De actie stuurt bewust niet zelf door naar de editor. Tussen "project
 * aangemaakt" en "editor open" zit nog een stap: de foto's moeten geüpload
 * worden, en die zitten in de browser. Een `redirect()` in de actie zou dat
 * moment overslaan en het project leeg achterlaten. Het id komt daarom terug en
 * de wizard beslist wanneer hij vertrekt.
 */
export type NewProjectActionState =
  | { status: "idle" }
  | { status: "gelukt"; projectId: ID }
  | {
      status: "fout";
      /** Melding over het geheel, boven de knoppen. */
      message: string;
      /** Meldingen per veld; de wizard springt naar de stap die erbij hoort. */
      fieldErrors?: DraftErrors;
    };

export const initialNewProjectState: NewProjectActionState = { status: "idle" };
