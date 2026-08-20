import type { FieldErrors } from "@/lib/auth/validation";

/**
 * Wat de accountacties teruggeven. Staat los van `actions.ts`, omdat een
 * "use server"-bestand alleen async functies mag exporteren.
 */
export type AccountActionState = {
  status: "idle" | "fout" | "gelukt";
  /** Melding over de handeling als geheel. */
  message?: string;
  /** Meldingen per veld, onder het veld zelf. */
  fieldErrors?: FieldErrors;
  /** Ingevulde waarden, zodat het formulier na een fout niet leegloopt. */
  values?: Record<string, string>;
  /**
   * De bevestigingslink bij een e-mailwijziging, alleen meteen na het
   * aanvragen. Zolang er geen e-mailprovider hangt, is dit de enige manier om
   * de wijziging af te ronden; van het token bewaren we alleen de hash.
   */
  confirmUrl?: string;
  /** `false` als de aanvraag klaarstaat maar de e-mail niet vertrok. */
  emailDelivered?: boolean;
};

export const initialAccountState: AccountActionState = { status: "idle" };
