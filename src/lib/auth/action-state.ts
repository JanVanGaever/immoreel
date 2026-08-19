import type { FieldErrors } from "@/lib/auth/validation";

/**
 * Wat een auth-formulier terugkrijgt van zijn serveractie.
 * Staat los van `actions.ts`, omdat een "use server"-bestand alleen
 * async functies mag exporteren.
 */
export type AuthActionState = {
  status: "idle" | "error" | "success";
  /** Melding over het formulier als geheel, boven de velden. */
  message?: string;
  /** Meldingen per veld, onder het veld zelf. */
  fieldErrors?: FieldErrors;
  /** Ingevulde waarden, zodat het formulier na een fout niet leegloopt. */
  values?: Record<string, string>;
};

export const initialAuthState: AuthActionState = { status: "idle" };
