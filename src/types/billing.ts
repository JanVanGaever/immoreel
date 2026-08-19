import type { ID, Timestamps } from "@/types/common";

export type PlanId = "starter" | "kantoor" | "groep";

export type Plan = {
  id: PlanId;
  name: string;
  description: string;
  pricePerMonthInCents: number;
  includedRendersPerMonth: number;
  features: string[];
};

export type SubscriptionStatus = "actief" | "proef" | "opgezegd" | "achterstallig";

export type Subscription = {
  id: ID;
  organisationId: ID;
  planId: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
} & Timestamps;

export type Invoice = {
  id: ID;
  organisationId: ID;
  number: string;
  amountInCents: number;
  currency: string;
  paidAt?: string | null;
  pdfUrl?: string | null;
} & Timestamps;
