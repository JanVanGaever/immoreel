import type { BrandKitErrors } from "@/lib/brand/validation";
import type { BrandKit } from "@/types";

/**
 * Wat het huisstijlformulier terugkrijgt van `saveBrandKitAction`. Staat los
 * van `actions.ts`, omdat een "use server"-bestand alleen async functies mag
 * exporteren — zelfde afspraak als bij de wizard, de editor en de
 * auth-formulieren.
 */

export type BrandKitState =
  | { status: "idle" }
  | {
      status: "opgeslagen";
      /** De kit zoals de server ze bewaard heeft; kan rechtgetrokken zijn. */
      kit: BrandKit;
      savedAt: string;
    }
  | {
      status: "fout";
      message: string;
      fieldErrors?: BrandKitErrors;
    };

export const initialBrandKitState: BrandKitState = { status: "idle" };
