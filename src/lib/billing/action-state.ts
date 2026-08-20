import type { PlanId } from "@/types";

/**
 * Wat de facturatieschermen terugkrijgen van de serveracties. Staat los van
 * `actions.ts`, omdat een "use server"-bestand alleen async functies mag
 * exporteren — zelfde afspraak als bij de wizard, de editor en de huisstijl.
 */

export type BillingActionState =
  | { status: "idle" }
  /** Klaar, zonder omweg: een downgrade of een opzegging. */
  | { status: "gelukt"; message: string }
  /**
   * Er is bijbetaald op het bestaande mandaat. De wissel is pas rond als Mollie
   * bevestigt, dus het scherm stuurt door naar de terugkeerpagina.
   */
  | { status: "betaling-gestart"; paymentId: string }
  /** Er is geen bruikbaar mandaat: de klant moet door een betaalscherm. */
  | { status: "checkout-nodig"; planId: PlanId }
  | { status: "fout"; message: string };

export const initialBillingState: BillingActionState = { status: "idle" };
