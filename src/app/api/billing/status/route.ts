import { getBillingStore } from "@/db/billing-store";
import { getDashboardStore } from "@/db/dashboard-store";
import { handle, jsonOk, requireApiSession } from "@/lib/api";
import { can } from "@/lib/auth/roles";
import {
  PLAN_LIMITS,
  getPlan,
  hasBillingAccess,
  isAwaitingPayment,
  periodSentence,
  priceBreakdown,
  subscriptionNeedsAction,
} from "@/lib/billing";
import { loadSubscription } from "@/lib/billing/service";
import { isMollieConfigured, isTestMode } from "@/lib/mollie/config";

/**
 * De stand van de facturatie: abonnement, plan en verbruik in één antwoord.
 *
 * Drie vragen worden hier samen beantwoord, omdat ze in de praktijk altijd
 * samen gesteld worden: wat loopt er, wat kost het, en hoeveel is er al
 * gebruikt. Een client die dat uit drie endpoints moet rapen, toont
 * onvermijdelijk een keer een plan bij het verbruik van vorige maand.
 *
 * `loadSubscription()` haalt de klok erdoorheen: een proefperiode die voorbij
 * is of een opzegging waarvan de datum verstreken is, staat hierna op de juiste
 * status. Deze route heeft dus een bijwerking, en dat is bewust — het is
 * dezelfde blik die de facturatiepagina werpt (zie `lib/billing/service.ts`).
 *
 * Lezen mag iedereen in het kantoor; op het scherm ziet een editor immers ook
 * wat er loopt. Wat er *niet* in gaat, zijn de ids van Mollie: die horen bij de
 * koppeling en niet bij de klant. De betaallink komt er alleen bij voor wie de
 * facturatie mag beheren.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireApiSession("project:view");
    const organisationId = session.organisation.id;
    const canManage = can(session.role, "billing:manage");

    const subscription = await loadSubscription(organisationId);
    const plan = getPlan(subscription.planId);
    const limits = PLAN_LIMITS[subscription.planId];
    const { usage } = await getDashboardStore().getOverview(organisationId);

    // Bij een lopende betaling hoort de link om ze af te maken; die is alleen
    // zinvol — en alleen bedoeld — voor wie mag betalen.
    const openCheckout =
      canManage && isAwaitingPayment(subscription.status)
        ? await getBillingStore().findOpenCheckout(organisationId)
        : null;

    return jsonOk({
      subscription: {
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEndsAt: subscription.trialEndsAt ?? null,
        /** Een kleiner plan dat ingaat zodra de betaalde periode om is. */
        pendingPlanId: subscription.pendingPlanId ?? null,
        paymentMethod: subscription.paymentMethod ?? null,
        /** Dezelfde zin als op het dashboard en de facturatiepagina. */
        summary: periodSentence(subscription),
      },
      plan: {
        id: plan.id,
        name: plan.name,
        includedRendersPerMonth: plan.includedRendersPerMonth,
        // Prijzen exclusief én inclusief btw: een kantoor rekent de btw terug,
        // maar wat er van de rekening gaat, is het brutobedrag.
        price: priceBreakdown(plan.pricePerMonthInCents),
        limits,
      },
      usage,
      access: {
        /** Mag dit kantoor de app nog gebruiken? Achterstallig telt als ja. */
        hasAccess: hasBillingAccess(subscription.status),
        needsAction: subscriptionNeedsAction(subscription.status),
        isAwaitingPayment: isAwaitingPayment(subscription.status),
        canManage,
      },
      openCheckout: openCheckout
        ? {
            paymentId: openCheckout.molliePaymentId,
            planId: openCheckout.planId,
            purpose: openCheckout.purpose,
            method: openCheckout.method,
            amountInCents: openCheckout.amountInCents,
            checkoutUrl: openCheckout.checkoutUrl ?? null,
          }
        : null,
      // Zonder sleutel kan er niets afgesloten worden; dat is iets anders dan
      // een abonnement dat niet loopt, en een client hoort het verschil te zien.
      provider: canManage
        ? { configured: isMollieConfigured(), testMode: isTestMode() }
        : undefined,
    });
  });
}
