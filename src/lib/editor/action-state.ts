import type { EditorErrors } from "@/lib/editor/validation";
import type { ID } from "@/types";

/**
 * Wat de editor terugkrijgt van de serveracties. Staat los van `actions.ts`,
 * omdat een "use server"-bestand alleen async functies mag exporteren — zelfde
 * afspraak als bij de wizard en de auth-formulieren.
 */

export type SaveState =
  | {
      status: "opgeslagen";
      /** ISO-tijdstip, zoals de server het bewaard heeft. */
      savedAt: string;
      /** De duur zoals de server ze berekend heeft; kan afwijken na afronding. */
      durationInSeconds: number;
    }
  | {
      status: "fout";
      message: string;
      fieldErrors?: EditorErrors;
    };

export type ExportRequest = {
  presetId: ID;
  label: string;
  /** Wat de renderworker straks maakt, bijvoorbeeld `1080x1920 · 30 fps`. */
  format: string;
};

export type ExportState =
  | { status: "idle" }
  | { status: "wachtrij"; message: string; requests: ExportRequest[] }
  | { status: "fout"; message: string };

export const initialExportState: ExportState = { status: "idle" };
