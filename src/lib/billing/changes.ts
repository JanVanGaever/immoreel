import { getPlan, planRank, priceBreakdown } from "@/lib/billing/plans";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PlanId, Subscription } from "@/types";

/**
 * Wat er gebeurt als iemand van plan wisselt.
 *
 * Dit bestand beantwoordt één vraag — "wat kost dit me, en wanneer gaat het
 * in?" — en het antwoord staat zowel op de knop in de plannenlijst als in de
 * bevestiging als in de serveractie. Puur en op één plek, zodat de zin die de
 * klant leest gegarandeerd dezelfde regel is als die de incasso bepaalt.
 *
 * De twee richtingen zijn met opzet niet symmetrisch:
 *
 * - **Upgraden gaat meteen in.** Wie meer renders nodig heeft, heeft ze nú
 *   nodig. Voor de rest van de lopende maand wordt het verschil pro rata
 *   aangerekend, op het mandaat dat er al is — geen betaalscherm.
 * - **Downgraden gaat in op het einde van de periode.** De maand is betaald;
 *   die halverwege afkappen zou een terugbetaling betekenen voor dagen die de
 *   klant nog gewoon kan gebruiken.
 */

export type PlanChangeKind = "start" | "upgrade" | "downgrade" | "gelijk";

export type PlanChange = {
  kind: PlanChangeKind;
  fromPlanId: PlanId | null;
  toPlanId: PlanId;
  /** Gaat het meteen in, of pas als de betaalde periode om is? */
  effectiveAt: "meteen" | "einde-periode";
  /**
   * Moet de klant door een betaalscherm? Alleen als er nog geen mandaat is, of
   * als het bestaande mandaat niet te vertrouwen valt.
   */
  needsCheckout: boolean;
  /** Wat er nu geïnd wordt, exclusief btw. `0` betekent: niets. */
  chargeNowInCents: number;
  /** Wat de knop zegt. */
  actionLabel: string;
  /** Eén zin die zegt wat er gaat gebeuren, inclusief bedrag en datum. */
  summary: string;
};

/**
 * Hoeveel van de lopende periode er nog over is, van 0 tot 1.
 *
 * Op hele dagen, niet op seconden. Een klant die om 9 uur upgradet en om 17 uur
 * dezelfde vraag stelt, hoort niet twee verschillende bedragen te zien.
 */
export function remainingPeriodFraction(subscription: Subscription, now: Date = new Date()): number {
  const start = new Date(subscription.currentPeriodStart).getTime();
  const end = new Date(subscription.currentPeriodEnd).getTime();
  const total = end - start;

  if (!Number.isFinite(total) || total <= 0) return 0;

  const day = 86_400_000;
  const remaining = Math.ceil((end - now.getTime()) / day) * day;

  return Math.min(Math.max(remaining / total, 0), 1);
}

/**
 * Het verschil dat een upgrade midden in een periode kost, exclusief btw.
 *
 * Naar beneden afgerond op hele centen: bij een verdeling die nooit precies
 * uitkomt, hoort het restje bij ons te blijven en niet bij de klant.
 */
export function prorationInCents(
  subscription: Subscription,
  toPlanId: PlanId,
  now: Date = new Date(),
): number {
  const difference =
    getPlan(toPlanId).pricePerMonthInCents - getPlan(subscription.planId).pricePerMonthInCents;

  if (difference <= 0) return 0;

  return Math.floor(difference * remainingPeriodFraction(subscription, now));
}

/**
 * Kan er zonder betaalscherm geïnd worden?
 *
 * Alleen met een geldig mandaat én een abonnement dat niet in de problemen zit.
 * Na een mislukte incasso is de kans groot dat juist het mandaat het probleem
 * is — dan is een nieuw betaalscherm geen omweg maar de oplossing.
 */
export function canChargeOnMandate(subscription: Subscription | null): boolean {
  if (!subscription) return false;

  return Boolean(
    subscription.mollieMandateId &&
      subscription.status !== "achterstallig" &&
      subscription.status !== "proef" &&
      subscription.status !== "wachtend",
  );
}

export function planChange(
  subscription: Subscription | null,
  toPlanId: PlanId,
  now: Date = new Date(),
): PlanChange {
  const target = getPlan(toPlanId);
  const onMandate = canChargeOnMandate(subscription);

  // Nog nooit betaald, of het mandaat is er niet (meer): dit is een start,
  // ongeacht welk plan er in de proefperiode al aan stond.
  if (!subscription || !onMandate) {
    const gross = priceBreakdown(target.pricePerMonthInCents).totalInCents;

    return {
      kind: "start",
      fromPlanId: subscription?.planId ?? null,
      toPlanId,
      effectiveAt: "meteen",
      needsCheckout: true,
      chargeNowInCents: target.pricePerMonthInCents,
      actionLabel: subscription?.status === "achterstallig" ? "Betaling hernieuwen" : "Kiezen",
      summary: `Je betaalt nu ${formatCurrency(gross)} voor de eerste maand en geeft meteen een machtiging af voor de volgende.`,
    };
  }

  if (subscription.planId === toPlanId && !subscription.pendingPlanId) {
    return {
      kind: "gelijk",
      fromPlanId: subscription.planId,
      toPlanId,
      effectiveAt: "meteen",
      needsCheckout: false,
      chargeNowInCents: 0,
      actionLabel: "Je huidige plan",
      summary: "Dit is het plan dat je nu hebt.",
    };
  }

  const isUpgrade = planRank(toPlanId) > planRank(subscription.planId);

  if (isUpgrade) {
    const charge = prorationInCents(subscription, toPlanId, now);
    const gross = priceBreakdown(charge).totalInCents;

    return {
      kind: "upgrade",
      fromPlanId: subscription.planId,
      toPlanId,
      effectiveAt: "meteen",
      needsCheckout: false,
      chargeNowInCents: charge,
      actionLabel: "Upgraden",
      summary:
        charge > 0
          ? `${target.name} gaat meteen in. Voor de rest van deze maand rekenen we ${formatCurrency(gross)} aan; vanaf ${formatDate(subscription.currentPeriodEnd)} het volle tarief.`
          : `${target.name} gaat meteen in. Deze periode is al betaald; vanaf ${formatDate(subscription.currentPeriodEnd)} geldt het nieuwe tarief.`,
    };
  }

  return {
    kind: "downgrade",
    fromPlanId: subscription.planId,
    toPlanId,
    effectiveAt: "einde-periode",
    needsCheckout: false,
    chargeNowInCents: 0,
    actionLabel: "Downgraden",
    summary: `Je houdt ${getPlan(subscription.planId).name} tot ${formatDate(subscription.currentPeriodEnd)}. Daarna gaat ${target.name} in en betaal je minder. Je krijgt nu niets aangerekend.`,
  };
}

/**
 * De periode die volgt op deze. Mollie int op de dag dat de vorige afloopt, dus
 * dit is meteen de datum van de volgende incasso.
 */
export function nextPeriod(from: Date | string): { start: string; end: string } {
  const start = new Date(from);
  const end = new Date(start);

  // `setMonth` corrigeert zelf: 31 januari plus een maand wordt 3 maart. Dat is
  // ongewenst voor een abonnement, dus zetten we de dag terug naar de laatste
  // van de bedoelde maand.
  const day = start.getDate();
  end.setMonth(end.getMonth() + 1);

  if (end.getDate() !== day) end.setDate(0);

  return { start: start.toISOString(), end: end.toISOString() };
}

/** `YYYY-MM-DD`, zoals Mollie een startdatum wil. */
export function toMollieDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}
