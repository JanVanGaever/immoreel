"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth/session";
import type { BillingActionState } from "@/lib/billing/action-state";
import { isPaymentMethodId } from "@/lib/billing/methods";
import { getPlan, isPlanId } from "@/lib/billing/plans";
import {
  applyPlanChange,
  applyPayment,
  cancelAtPeriodEnd,
  loadSubscription,
  resumeSubscription,
  startCheckout,
} from "@/lib/billing/service";
import { ROUTES } from "@/lib/constants";
import { MollieError } from "@/lib/mollie/client";
import { isMollieConfigured } from "@/lib/mollie/config";
import { formatDate } from "@/lib/format";
import type { PaymentMethodId, PlanId } from "@/types";

/**
 * De serveracties van de facturatie.
 *
 * Hier gaat geld om, dus geldt hier strenger dan elders: alleen een eigenaar
 * (`billing:manage`), niets uit de browser wordt geloofd, en elke fout van
 * Mollie wordt vertaald naar een zin waar de klant iets aan heeft in plaats van
 * doorgegeven zoals hij binnenkomt.
 */

/**
 * Naar het betaalscherm van Mollie.
 *
 * De actie eindigt met `redirect()` naar Mollie zelf. Dat is bewust geen URL
 * die naar de browser teruggaat om daar geopend te worden: hoe korter de weg
 * tussen "ik kies dit plan" en het betaalscherm, hoe minder er tussen kan
 * komen.
 */
export async function startCheckoutAction(
  planId: PlanId,
  method: PaymentMethodId,
): Promise<BillingActionState> {
  const { organisation, user } = await assertPermission("billing:manage");

  if (!isPlanId(planId)) return { status: "fout", message: "Onbekend plan." };
  if (!isPaymentMethodId(method)) {
    return { status: "fout", message: "Kies een betaalmethode." };
  }
  if (!isMollieConfigured()) return { status: "fout", message: NOT_CONFIGURED };

  const subscription = await loadSubscription(organisation.id);

  let target: string;

  try {
    const result = await startCheckout({
      organisation,
      user,
      planId,
      method,
      // Na een mislukte incasso is dit geen nieuwe start maar een herkansing;
      // dat verschil bepaalt wat er in het overzicht komt te staan.
      purpose: subscription.status === "achterstallig" ? "herkansing" : "start",
    });

    if (!result.checkoutUrl) {
      return {
        status: "fout",
        message: "Mollie gaf geen betaalscherm terug. Probeer een andere betaalmethode.",
      };
    }

    target = result.checkoutUrl;
  } catch (error) {
    return { status: "fout", message: mollieMessage(error) };
  }

  // `redirect()` gooit; alles hierboven is dus al afgerond.
  redirect(target);
}

/**
 * Van plan wisselen zonder betaalscherm.
 *
 * Kan alleen als er een geldig mandaat is. Is dat er niet, dan geeft dit
 * `checkout-nodig` terug en stuurt het scherm de klant naar de afrekenpagina —
 * geen foutmelding, want er is niets misgegaan.
 */
export async function changePlanAction(planId: PlanId): Promise<BillingActionState> {
  const { organisation } = await assertPermission("billing:manage");

  if (!isPlanId(planId)) return { status: "fout", message: "Onbekend plan." };
  if (!isMollieConfigured()) return { status: "fout", message: NOT_CONFIGURED };

  try {
    const result = await applyPlanChange(organisation, planId);

    if (result.outcome === "checkout-nodig") return { status: "checkout-nodig", planId };
    if (result.outcome === "betaling-gestart") {
      revalidateBilling();

      return { status: "betaling-gestart", paymentId: result.paymentId };
    }

    revalidateBilling();

    const plan = getPlan(planId);
    const { subscription } = result;

    return {
      status: "gelukt",
      message: subscription.pendingPlanId
        ? `${plan.name} gaat in op ${formatDate(subscription.currentPeriodEnd)}. Tot dan verandert er niets.`
        : `Je zit nu op ${plan.name}.`,
    };
  } catch (error) {
    return { status: "fout", message: mollieMessage(error) };
  }
}

/** Opzeggen tegen het einde van de betaalde periode. */
export async function cancelSubscriptionAction(): Promise<BillingActionState> {
  const { organisation } = await assertPermission("billing:manage");

  try {
    const subscription = await cancelAtPeriodEnd(organisation);
    revalidateBilling();

    return {
      status: "gelukt",
      message:
        subscription.status === "opgezegd"
          ? "Je proefperiode is stopgezet."
          : `Er wordt niets meer afgeschreven. Je kan Immoreel nog gebruiken tot ${formatDate(subscription.currentPeriodEnd)}.`,
    };
  } catch (error) {
    return { status: "fout", message: mollieMessage(error) };
  }
}

/** De opzegging terugdraaien, zolang de betaalde periode nog loopt. */
export async function resumeSubscriptionAction(): Promise<BillingActionState> {
  const { organisation } = await assertPermission("billing:manage");

  // Hervatten betekent een nieuw abonnement bij Mollie; opzeggen niet. Daarom
  // staat deze controle hier wel en bij `cancelSubscriptionAction` niet: een
  // opzegging mag nooit stranden op een betaalprovider die er even uit ligt.
  if (!isMollieConfigured()) return { status: "fout", message: NOT_CONFIGURED };

  try {
    const subscription = await resumeSubscription(organisation);
    revalidateBilling();

    return {
      status: "gelukt",
      message: `Je abonnement loopt gewoon door en verlengt op ${formatDate(subscription.currentPeriodEnd)}.`,
    };
  } catch (error) {
    return { status: "fout", message: mollieMessage(error) };
  }
}

/**
 * De stand van een betaling ophalen bij Mollie en verwerken.
 *
 * De terugkeerpagina gebruikt dit omdat de webhook er niet altijd eerst is — en
 * bij ontwikkelen op `localhost` zelfs helemaal nooit. Dezelfde functie als de
 * webhook draait, dus dit is geen tweede waarheid maar dezelfde, alleen eerder
 * opgevraagd.
 */
export async function syncPaymentAction(paymentId: string): Promise<BillingActionState> {
  const { organisation } = await assertPermission("billing:manage");

  if (!/^tr_[A-Za-z0-9]+$/.test(paymentId)) {
    return { status: "fout", message: "Onbekende betaling." };
  }

  try {
    await applyPayment(paymentId);
    revalidateBilling();

    const subscription = await loadSubscription(organisation.id);

    return {
      status: "gelukt",
      message:
        subscription.status === "actief"
          ? "De betaling is bevestigd."
          : "We wachten nog op je bank.",
    };
  } catch (error) {
    return { status: "fout", message: mollieMessage(error) };
  }
}

const NOT_CONFIGURED =
  "Betalingen zijn op deze omgeving nog niet geconfigureerd. Neem contact op met support.";

function revalidateBilling(): void {
  revalidatePath(ROUTES.billing);
  revalidatePath(ROUTES.dashboard);
}

/**
 * Van een fout van Mollie naar een zin voor de klant.
 *
 * Wat Mollie zegt is voor ontwikkelaars geschreven ("The customer has no valid
 * mandates"). Wat er op het scherm hoort te staan is wat de klant nu kan doen.
 */
function mollieMessage(error: unknown): string {
  if (error instanceof MollieError) {
    if (error.isTransient) {
      return "Mollie is even niet bereikbaar. Probeer het over een minuutje opnieuw.";
    }
    if (error.status === 401 || error.status === 403) {
      return "De koppeling met Mollie is niet in orde. Neem contact op met support.";
    }
    if (error.detail.toLowerCase().includes("mandate")) {
      return "Er is geen geldige machtiging meer. Kies hieronder opnieuw een betaalmethode.";
    }

    return `De betaling kon niet gestart worden: ${error.detail}`;
  }

  return "Er ging iets mis bij het verwerken van je betaling. Probeer het opnieuw.";
}
