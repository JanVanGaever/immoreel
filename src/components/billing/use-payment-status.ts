"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createLogger } from "@/lib/errors/logger";
import { toAppError } from "@/lib/errors/normalize";
import { requestJson } from "@/lib/errors/request";
import { API_ROUTES } from "@/lib/constants";
import type { AppErrorShape } from "@/types/error";
import type {
  CheckoutAttemptStatus,
  PaymentMethodId,
  PaymentPurpose,
  PlanId,
  SubscriptionStatus,
} from "@/types";

/**
 * De stand van een betaling volgen na de terugkeer van Mollie.
 *
 * Pollen en geen open verbinding, want dit duurt seconden en geen minuten — en
 * het moet het ook doen op een telefoon die net van Bancontact terugkomt,
 * achter elke proxy en elke bedrijfsfirewall.
 *
 * De tussenpozen lopen op. In de eerste seconden is de kans het grootst dat het
 * antwoord er al is (een kaartbetaling is meteen rond), en daarna wordt die
 * kans per poging kleiner terwijl de last per poging gelijk blijft. Na twee
 * minuten stopt het uit zichzelf: een SEPA-incasso doet er dagen over, en dan
 * is een draaiend wieltje geen informatie meer maar een leugen.
 */

export type PaymentStatus = {
  paymentId: string;
  status: CheckoutAttemptStatus;
  planId: PlanId;
  purpose: PaymentPurpose;
  method: PaymentMethodId;
  amountInCents: number;
  failureReason: string | null;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string;
};

export type PaymentStatusState = {
  /** `null` tot het eerste antwoord binnen is. */
  payment: PaymentStatus | null;
  /** Wachten we nog op een uitkomst? */
  isPolling: boolean;
  /** Twee minuten voorbij zonder uitkomst. */
  hasTimedOut: boolean;
  /**
   * De laatste fout, of `null`. De hele fout en niet enkel de zin: het scherm
   * moet het verschil kunnen zien tussen "we vinden deze betaling niet"
   * (`payment-not-found`, en dan is doorzoeken zinloos) en "de server
   * antwoordde niet" (`network`, en dan komt het zo misschien wel goed).
   */
  error: AppErrorShape | null;
  /** Opnieuw beginnen met kijken, bijvoorbeeld op een knop. */
  check: () => void;
};

/** Oplopend, in milliseconden. De laatste waarde blijft gelden. */
const INTERVALS = [1_000, 1_500, 2_000, 3_000, 4_000, 5_000, 8_000];
const TIMEOUT_MS = 120_000;

const log = createLogger("billing");

export function usePaymentStatus(paymentId: string): PaymentStatusState {
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState<AppErrorShape | null>(null);
  const [hasTimedOut, setTimedOut] = useState(false);
  /** De lus is gestopt op een fout waar wachten niets aan verandert. */
  const [stopped, setStopped] = useState(false);
  /** Verhogen begint een nieuwe ronde; zo is `check()` niet meer dan dat. */
  const [round, setRound] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (): Promise<CheckoutAttemptStatus> => {
    const data = await requestJson<PaymentStatus>(API_ROUTES.paymentStatus(paymentId));

    setPayment(data);
    setError(null);

    return data.status;
  }, [paymentId]);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const startedAt = Date.now();

    async function tick() {
      try {
        const status = await load();

        if (cancelled) return;
        // Uitkomst bekend: de lus is klaar.
        if (status !== "open") return;
      } catch (cause) {
        if (cancelled) return;

        const failure = toAppError(cause, { context: { paymentId } });

        log.warn("betaalstatus ophalen mislukt", {
          paymentId,
          errorCode: failure.code,
          errorId: failure.errorId,
        });

        setError(failure.toShape());

        // Een fout die niet vanzelf overgaat, stopt de lus: een betaling die
        // niet bestaat, bestaat over acht seconden nog altijd niet. Bij een
        // hapering gaat het pollen wél door — de volgende poging kan slagen.
        if (!failure.isAutoRetryable) {
          setStopped(true);
          return;
        }
      }

      if (Date.now() - startedAt > TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }

      const wait = INTERVALS[Math.min(attempt, INTERVALS.length - 1)]!;
      attempt += 1;
      timer.current = setTimeout(() => void tick(), wait);
    }

    void tick();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load, paymentId, round]);

  const check = useCallback(() => {
    setTimedOut(false);
    setStopped(false);
    setRound((current) => current + 1);
  }, []);

  return {
    payment,
    isPolling: !hasTimedOut && !stopped && (payment?.status ?? "open") === "open",
    hasTimedOut,
    error,
    check,
  };
}
