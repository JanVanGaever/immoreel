// Plannen, prijzen, statussen en wat een planwissel betekent. Puur: geen
// netwerk, geen store. De serveracties staan in `actions.ts` en horen bewust
// niet in deze barrel — een "use server"-bestand hier meenemen zou elk scherm
// dat een prijs toont aan de betaalprovider koppelen.
// import { PLAN_LIST, getPlan, planChange } from "@/lib/billing";

export {
  canChargeOnMandate,
  nextPeriod,
  planChange,
  prorationInCents,
  remainingPeriodFraction,
  toMollieDate,
} from "@/lib/billing/changes";
export {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_VARIANTS,
  PAYMENT_PURPOSE_LABELS,
  describeInvoice,
  failureAdvice,
  failureMessage,
  invoiceNumber,
  invoiceStatusFor,
} from "@/lib/billing/invoices";
export {
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHODS,
  findPaymentMethod,
  fromMollieMethod,
  isPaymentMethodId,
} from "@/lib/billing/methods";
export {
  PLAN_LIMITS,
  PLAN_LIST,
  PLANS,
  RECOMMENDED_PLAN_ID,
  TRIAL_DAYS,
  VAT_RATE,
  getPlan,
  grossPriceInCents,
  isPlanId,
  planRank,
  priceBreakdown,
  vatInCents,
} from "@/lib/billing/plans";
export {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_VARIANTS,
  hasBillingAccess,
  isAwaitingPayment,
  periodSentence,
  subscriptionNeedsAction,
} from "@/lib/billing/status";

export type { PlanChange, PlanChangeKind } from "@/lib/billing/changes";
export type { PaymentMethodOption } from "@/lib/billing/methods";
export type { PriceBreakdown } from "@/lib/billing/plans";
export type { SubscriptionLike } from "@/lib/billing/status";
