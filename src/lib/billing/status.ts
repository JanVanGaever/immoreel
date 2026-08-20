import type { BadgeVariant } from "@/components/ui/badge";
import { getPlan } from "@/lib/billing/plans";
import { daysUntil } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import type { PlanId, SubscriptionStatus } from "@/types";

/**
 * De vijf toestanden waarin een abonnement kan staan, en wat ze betekenen.
 *
 * Er is bewust geen aparte status voor "opgezegd maar nog geldig". Dat is geen
 * andere toestand — het abonnement is gewoon actief tot het einde van de
 * betaalde periode — en er een status van maken zou betekenen dat er twee
 * plekken zijn waar staat of het kantoor mag renderen. `cancelAtPeriodEnd`
 * hoort bij het abonnement, niet bij zijn status.
 */

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  proef: "Proefperiode",
  wachtend: "Betaling loopt",
  actief: "Actief",
  achterstallig: "Betaling openstaand",
  opgezegd: "Opgezegd",
};

export const SUBSCRIPTION_STATUS_VARIANTS: Record<SubscriptionStatus, BadgeVariant> = {
  proef: "info",
  wachtend: "warning",
  actief: "success",
  achterstallig: "danger",
  opgezegd: "neutral",
};

/** Statussen waarbij de gebruiker iets moet doen voor de dienst stopt. */
export function subscriptionNeedsAction(status: SubscriptionStatus): boolean {
  return status === "achterstallig" || status === "opgezegd";
}

/**
 * Mag dit kantoor de app nog gebruiken?
 *
 * Achterstallig telt hier bewust als ja. Een mislukte incasso is bijna altijd
 * een kaart die verlopen is of een rekening die even leeg stond, en een
 * makelaar die daardoor midden op de dag zijn video niet kan afwerken, belt
 * niet de bank maar zegt op. De dienst blijft dus lopen; het scherm zegt wel
 * duidelijk wat er moet gebeuren.
 */
export function hasBillingAccess(status: SubscriptionStatus): boolean {
  return status !== "opgezegd";
}

/** Loopt er een betaling waar we het antwoord nog van moeten krijgen? */
export function isAwaitingPayment(status: SubscriptionStatus): boolean {
  return status === "wachtend";
}

/**
 * Precies genoeg van een abonnement om er een zin over te schrijven. Zo werkt
 * `periodSentence()` zowel op het volledige abonnement van de facturatiepagina
 * als op de samenvatting die het dashboard krijgt.
 */
export type SubscriptionLike = {
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string | null;
  pendingPlanId?: PlanId | null;
};

/**
 * Eén zin die zegt wat er met het abonnement gaat gebeuren.
 *
 * Staat hier en niet in een component, omdat het dashboard en de
 * facturatiepagina allebei dezelfde zin horen te tonen. Twee schermen die het
 * anders zeggen over hetzelfde abonnement, is precies waar een support-mail
 * mee begint.
 */
export function periodSentence(subscription: SubscriptionLike): string {
  const date = formatDate(subscription.currentPeriodEnd);

  if (subscription.status === "proef") {
    const days = daysUntil(subscription.trialEndsAt ?? subscription.currentPeriodEnd);
    const rest = days > 1 ? `Nog ${days} dagen` : days === 1 ? "Nog één dag" : "Laatste dag";

    return `${rest} proefperiode, tot ${date}.`;
  }

  if (subscription.status === "wachtend") return "We wachten op de bevestiging van je bank.";
  if (subscription.status === "opgezegd") return "Je hebt op dit moment geen lopend abonnement.";
  if (subscription.status === "achterstallig") {
    return `De incasso voor de periode tot ${date} is niet gelukt.`;
  }
  if (subscription.cancelAtPeriodEnd) return `Loopt af op ${date}. Daarna stoppen de renders.`;
  if (subscription.pendingPlanId) {
    return `Verlengt op ${date}, dan op ${getPlan(subscription.pendingPlanId).name}.`;
  }

  return `Verlengt automatisch op ${date}.`;
}
