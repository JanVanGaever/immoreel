import { randomUUID } from "node:crypto";
import { isSeedEnabled, seedInvoices, seedSubscription } from "@/db/seed";
import { describeInvoice, invoiceNumber } from "@/lib/billing/invoices";
import { TRIAL_DAYS, priceBreakdown } from "@/lib/billing/plans";
import { DEFAULT_CURRENCY } from "@/lib/constants";
import type {
  CheckoutAttempt,
  CheckoutAttemptStatus,
  ID,
  Invoice,
  InvoiceStatus,
  PaymentMethodId,
  PaymentPurpose,
  PlanId,
  Subscription,
} from "@/types";

/**
 * Abonnement, facturen en lopende afrekeningen achter één poort — zoals de
 * auth-, project- en huisstijlstore.
 *
 * Twee dingen maken deze store anders dan de rest, en allebei komen ze van de
 * webhook:
 *
 * - **Er wordt van twee kanten geschreven.** Het scherm van de klant en de
 *   webhook van Mollie kunnen tegelijk aankomen, en de webhook kan zelfs vóór
 *   de klant terug is. Elke schrijfactie hieronder is daarom opgebouwd rond
 *   "wat er nu staat" en niet rond "wat ik dacht dat er stond".
 * - **Dezelfde opdracht komt twee keer aan.** Mollie herhaalt zijn webhook tot
 *   hij een 200 krijgt, en soms daarna nog eens. Daarom is `recordInvoice()`
 *   een upsert op de betaal-id van Mollie: twee keer dezelfde melding levert
 *   één regel op, niet twee.
 *
 * De implementatie hieronder houdt alles in het geheugen van het proces. De
 * databankversie schrijft die tweede regel als een uniciteitsvoorwaarde:
 *
 *   CREATE UNIQUE INDEX ON invoices (mollie_payment_id) WHERE mollie_payment_id IS NOT NULL
 */

export type SubscriptionPatch = Partial<
  Omit<Subscription, "id" | "organisationId" | "createdAt" | "updatedAt">
>;

export type RecordInvoiceInput = {
  organisationId: ID;
  molliePaymentId: string | null;
  status: InvoiceStatus;
  purpose: PaymentPurpose;
  planId: PlanId;
  /** Exclusief btw; de btw en het totaal worden hier berekend. */
  subtotalInCents: number;
  method?: PaymentMethodId | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
  description?: string;
};

export type CreateCheckoutInput = {
  organisationId: ID;
  molliePaymentId: string;
  planId: PlanId;
  purpose: PaymentPurpose;
  method: PaymentMethodId;
  amountInCents: number;
  checkoutUrl: string | null;
};

export type BillingStore = {
  /**
   * Altijd een abonnement. Een organisatie die nooit iets gekozen heeft, krijgt
   * haar proefperiode terug in plaats van `null` — zo hoeft geen enkel scherm
   * na te denken over "wat als er geen abonnement is".
   */
  getSubscription(organisationId: ID): Promise<Subscription>;
  updateSubscription(organisationId: ID, patch: SubscriptionPatch): Promise<Subscription>;
  /** De webhook kent alleen de ids van Mollie; hiermee vindt hij de organisatie terug. */
  findByMollieCustomerId(customerId: string): Promise<Subscription | null>;
  findByMollieSubscriptionId(subscriptionId: string): Promise<Subscription | null>;

  listInvoices(organisationId: ID): Promise<Invoice[]>;
  /** Upsert op `molliePaymentId`: twee keer dezelfde webhook geeft één regel. */
  recordInvoice(input: RecordInvoiceInput): Promise<Invoice>;
  findInvoiceByPaymentId(molliePaymentId: string): Promise<Invoice | null>;

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutAttempt>;
  findCheckout(molliePaymentId: string): Promise<CheckoutAttempt | null>;
  /** De laatste afrekening die nog loopt; `null` als er niets openstaat. */
  findOpenCheckout(organisationId: ID): Promise<CheckoutAttempt | null>;
  settleCheckout(
    molliePaymentId: string,
    status: CheckoutAttemptStatus,
    failureReason?: string | null,
  ): Promise<CheckoutAttempt | null>;

  /* --- Intern: over alle organisaties heen ------------------------------ */
  /**
   * Alleen voor het interne supportpaneel (`src/db/admin-store.ts`).
   *
   * Let op het verschil met `getSubscription()`: dat maakt een proefperiode aan
   * voor wie er nog geen heeft, en dat hoort een supportpaneel nooit te doen.
   * Deze geeft terug wat er staat, en niets meer — een kantoor zonder rij komt
   * er dus niet in voor, en het paneel zegt dat ook zo.
   */
  listAllSubscriptions(): Promise<Subscription[]>;
  listAllInvoices(): Promise<Invoice[]>;
  listAllCheckouts(): Promise<CheckoutAttempt[]>;
};

declare global {
  var __immoreelBilling:
    | {
        subscriptions: Map<ID, Subscription>;
        invoices: Map<ID, Invoice>;
        checkouts: Map<string, CheckoutAttempt>;
      }
    | undefined;
}

function getData() {
  globalThis.__immoreelBilling ??= seed({
    subscriptions: new Map(),
    invoices: new Map(),
    checkouts: new Map(),
  });

  return globalThis.__immoreelBilling;
}

type BillingData = NonNullable<typeof globalThis.__immoreelBilling>;

/**
 * Het abonnement van het demokantoor met zijn betaalgeschiedenis
 * (`src/db/seed/billing.ts`).
 *
 * Meteen bij het opzetten van de data, en niet pas wanneer iemand
 * `getSubscription()` aanroept. Anders bestaat het abonnement wél op de
 * facturatiepagina en niet in `listAllSubscriptions()`, en dat is precies het
 * verschil waarop het adminpaneel zou struikelen: dat leest bewust nooit
 * `getSubscription()`, om geen proefperiode aan te maken door te kijken.
 */
function seed(data: BillingData): BillingData {
  if (!isSeedEnabled()) return data;

  const subscription = seedSubscription();
  data.subscriptions.set(subscription.organisationId, subscription);

  for (const invoice of seedInvoices()) data.invoices.set(invoice.id, invoice);

  return data;
}

function id(prefix: string): ID {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/* -------------------------------------------------------------------------
 * Beginstand
 * ---------------------------------------------------------------------- */

/** Een nieuwe organisatie krijgt veertien dagen proef op het aangeraden plan. */
function createTrial(organisationId: ID): Subscription {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString();

  return {
    id: id("sub"),
    organisationId,
    planId: "kantoor",
    status: "proef",
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: trialEndsAt,
    cancelAtPeriodEnd: false,
    trialEndsAt,
    pendingPlanId: null,
    paymentMethod: null,
    mollieCustomerId: null,
    mollieSubscriptionId: null,
    mollieMandateId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/* -------------------------------------------------------------------------
 * Facturen
 * ---------------------------------------------------------------------- */

function buildInvoice(input: RecordInvoiceInput, number: string): Invoice {
  const now = new Date().toISOString();
  const breakdown = priceBreakdown(input.subtotalInCents);

  return {
    id: id("inv"),
    organisationId: input.organisationId,
    number,
    status: input.status,
    purpose: input.purpose,
    planId: input.planId,
    description: input.description ?? describeInvoice(input.purpose, input.planId),
    subtotalInCents: breakdown.subtotalInCents,
    vatInCents: breakdown.vatInCents,
    amountInCents: breakdown.totalInCents,
    currency: DEFAULT_CURRENCY,
    method: input.method ?? null,
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
    paidAt: input.paidAt ?? null,
    failureReason: input.failureReason ?? null,
    molliePaymentId: input.molliePaymentId,
    pdfUrl: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Het volgende nummer in de reeks van dit jaar, voor deze organisatie. */
function nextInvoiceNumber(organisationId: ID, year: number): string {
  const prefix = `${year}-`;
  const used = [...getData().invoices.values()].filter(
    (invoice) => invoice.organisationId === organisationId && invoice.number.startsWith(prefix),
  );

  return invoiceNumber(year, used.length + 1);
}

/* -------------------------------------------------------------------------
 * De store
 * ---------------------------------------------------------------------- */

const memoryStore: BillingStore = {
  async getSubscription(organisationId) {
    const existing = getData().subscriptions.get(organisationId);
    if (existing) return existing;

    // Het demokantoor staat er al vanaf de seed; wie hier belandt is een
    // organisatie zonder abonnement, en die begint aan haar proefperiode.
    const subscription = createTrial(organisationId);

    getData().subscriptions.set(organisationId, subscription);

    return subscription;
  },

  async updateSubscription(organisationId, patch) {
    const current = await this.getSubscription(organisationId);
    const updated: Subscription = { ...current, ...patch, updatedAt: new Date().toISOString() };

    getData().subscriptions.set(organisationId, updated);

    return updated;
  },

  async findByMollieCustomerId(customerId) {
    return (
      [...getData().subscriptions.values()].find(
        (subscription) => subscription.mollieCustomerId === customerId,
      ) ?? null
    );
  },

  async findByMollieSubscriptionId(subscriptionId) {
    return (
      [...getData().subscriptions.values()].find(
        (subscription) => subscription.mollieSubscriptionId === subscriptionId,
      ) ?? null
    );
  },

  async listInvoices(organisationId) {
    return (
      [...getData().invoices.values()]
        .filter((invoice) => invoice.organisationId === organisationId)
        // Op betaaldatum en niet op wanneer de rij ontstond: bij een incasso die
        // dagen onderweg is, lopen die twee uiteen, en de klant zoekt op de
        // datum die op zijn afschrift staat.
        .sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt))
    );
  },

  async findInvoiceByPaymentId(molliePaymentId) {
    return (
      [...getData().invoices.values()].find(
        (invoice) => invoice.molliePaymentId === molliePaymentId,
      ) ?? null
    );
  },

  async recordInvoice(input) {
    const data = getData();
    const existing = input.molliePaymentId
      ? await this.findInvoiceByPaymentId(input.molliePaymentId)
      : null;

    if (existing) {
      // Een herhaalde webhook mag de status bijwerken, maar nooit een tweede
      // regel of een nieuw nummer opleveren: dat nummer staat in de boekhouding.
      const updated: Invoice = {
        ...existing,
        status: input.status,
        paidAt: input.paidAt ?? existing.paidAt,
        method: input.method ?? existing.method,
        failureReason: input.failureReason ?? null,
        updatedAt: new Date().toISOString(),
      };

      data.invoices.set(updated.id, updated);

      return updated;
    }

    const year = new Date(input.paidAt ?? Date.now()).getFullYear();
    const invoice = buildInvoice(input, nextInvoiceNumber(input.organisationId, year));

    data.invoices.set(invoice.id, invoice);

    return invoice;
  },

  async createCheckout(input) {
    const now = new Date().toISOString();
    const attempt: CheckoutAttempt = {
      id: id("chk"),
      organisationId: input.organisationId,
      molliePaymentId: input.molliePaymentId,
      planId: input.planId,
      purpose: input.purpose,
      method: input.method,
      amountInCents: input.amountInCents,
      status: "open",
      checkoutUrl: input.checkoutUrl,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    };

    getData().checkouts.set(attempt.molliePaymentId, attempt);

    return attempt;
  },

  async findCheckout(molliePaymentId) {
    return getData().checkouts.get(molliePaymentId) ?? null;
  },

  async findOpenCheckout(organisationId) {
    return (
      [...getData().checkouts.values()]
        .filter(
          (attempt) => attempt.organisationId === organisationId && attempt.status === "open",
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  },

  async settleCheckout(molliePaymentId, status, failureReason = null) {
    const current = getData().checkouts.get(molliePaymentId);
    if (!current) return null;

    const updated: CheckoutAttempt = {
      ...current,
      status,
      failureReason,
      updatedAt: new Date().toISOString(),
    };

    getData().checkouts.set(molliePaymentId, updated);

    return updated;
  },

  async listAllSubscriptions() {
    return [...getData().subscriptions.values()];
  },

  async listAllInvoices() {
    return [...getData().invoices.values()].sort((a, b) =>
      (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt),
    );
  },

  async listAllCheckouts() {
    return [...getData().checkouts.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },
};

export function getBillingStore(): BillingStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  return memoryStore;
}
