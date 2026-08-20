import type { FieldErrors } from "@/lib/auth/validation";

/**
 * Wat de teamacties teruggeven. Staat los van `actions.ts`, omdat een
 * "use server"-bestand alleen async functies mag exporteren.
 */
export type TeamActionState = {
  status: "idle" | "fout" | "gelukt";
  /** Melding over de handeling als geheel. */
  message?: string;
  /** Meldingen per veld, onder het veld zelf. */
  fieldErrors?: FieldErrors;
  /** Ingevulde waarden, zodat het formulier na een fout niet leegloopt. */
  values?: Record<string, string>;
  /**
   * De uitnodigingslink, alleen meteen na uitnodigen of opnieuw versturen.
   * Daarna bestaat ze nergens meer: van het token bewaren we enkel de hash.
   * Zolang er geen e-mailprovider hangt, is dit de manier om een collega
   * binnen te krijgen — en ook daarna blijft "link kopiëren" nuttig voor een
   * mail die in de spam belandt.
   */
  inviteUrl?: string;
  /** `false` als de uitnodiging wel klaarstaat maar de e-mail niet vertrok. */
  emailDelivered?: boolean;
};

export const initialTeamState: TeamActionState = { status: "idle" };
