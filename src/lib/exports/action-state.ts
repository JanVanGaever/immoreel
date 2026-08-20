import type { ID, RenderJobSnapshot } from "@/types";

/**
 * Wat de downloadpagina terugkrijgt van haar serveractie. Staat los van
 * `actions.ts`, want een "use server"-bestand mag alleen async functies
 * exporteren — dezelfde afspraak als bij de editor, de wizard en de
 * auth-formulieren.
 */

export type RetryState =
  | { status: "idle" }
  | {
      status: "wachtrij";
      message: string;
      /**
       * De stand van de opnieuw ingestuurde jobs, meteen na het insturen. De
       * pagina zet die er zelf al in, zodat de kaart binnen de klik van "Mislukt"
       * naar "In wachtrij" springt in plaats van te wachten tot een worker
       * wakker wordt.
       */
      snapshots: RenderJobSnapshot[];
    }
  | { status: "fout"; message: string };

export const initialRetryState: RetryState = { status: "idle" };

/** Welke exports opnieuw geprobeerd worden; leeg is geen geldige opdracht. */
export type RetryRequest = { projectId: ID; presetIds: ID[] };
