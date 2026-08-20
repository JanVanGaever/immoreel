"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleX, Clock, RotateCcw } from "lucide-react";
import { usePaymentStatus } from "@/components/billing/use-payment-status";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { findPaymentMethod } from "@/lib/billing/methods";
import { getPlan } from "@/lib/billing/plans";
import { ROUTES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";

/**
 * Wat de klant ziet als hij terugkomt van Mollie.
 *
 * De eerlijke uitkomst is er een van drie, en alle drie hebben ze een eigen
 * scherm nodig:
 *
 * - **Gelukt.** Zeg wat er nu geldt en waar hij verder kan.
 * - **Mislukt.** Zeg waarom, in gewone woorden, en zet de knop om het opnieuw
 *   te proberen er meteen bij.
 * - **Nog niet bekend.** Dat is geen tussentoestand om weg te moffelen: een
 *   SEPA-incasso staat dagen op "pending", en dan is "we laten het weten" het
 *   enige juiste antwoord. De klant mag intussen gewoon doorwerken.
 *
 * Wat er níet gebeurt, is de betaling goedrekenen omdat Mollie de klant hier
 * naartoe stuurde. Die terugkeer zegt alleen dat het scherm klaar is, niet dat
 * er geld overkwam — dat weten we pas uit de betaling zelf.
 */

export type PaymentResultProps = {
  paymentId: string;
};

export function PaymentResult({ paymentId }: PaymentResultProps) {
  const router = useRouter();
  const { payment, isPolling, hasTimedOut, error, check } = usePaymentStatus(paymentId);

  // Zodra het rond is, mag de rest van de app het ook weten: het dashboard en
  // de facturatiepagina staan nog op de oude toestand.
  useEffect(() => {
    if (payment && payment.status !== "open") router.refresh();
  }, [payment, router]);

  // Nog niets binnen. Blijft dat zo én komt er een fout, dan is er iets mis met
  // het id zelf — een eeuwig draaiend wieltje is dan het verkeerde antwoord.
  if (!payment) {
    if (error) {
      return (
        <Result
          tone="danger"
          title="We vinden deze betaling niet"
          lead={error}
        >
          <p className="text-sm text-fg-muted">
            Controleer op de facturatiepagina of je betaling doorgegaan is. Staat ze daar niet, dan
            is er niets aangerekend.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={ROUTES.billing} className={buttonClasses("primary", "md")}>
              Naar facturatie
            </Link>
            <Button variant="secondary" icon={<RotateCcw />} onClick={check}>
              Opnieuw proberen
            </Button>
          </div>
        </Result>
      );
    }

    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-10">
          <Spinner label="Bezig met controleren" />
          <p className="text-sm text-fg-muted">We halen de stand van je betaling op…</p>
        </CardContent>
      </Card>
    );
  }

  const plan = getPlan(payment.planId);
  const method = findPaymentMethod(payment.method);

  if (payment.status === "geslaagd") {
    return (
      <Result
        tone="success"
        title="Je betaling is gelukt"
        lead={`${plan.name} staat vanaf nu actief op je kantoor.`}
      >
        <dl className="space-y-2 text-sm">
          <Row label="Betaald" value={formatCurrency(payment.amountInCents)} />
          <Row label="Methode" value={method.label} />
          <Row label="Volgende afschrijving" value={formatDate(payment.currentPeriodEnd)} />
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={ROUTES.newProject} className={buttonClasses("primary", "md")}>
            Eerste video maken
          </Link>
          <Link href={ROUTES.billing} className={buttonClasses("secondary", "md")}>
            Naar facturatie
          </Link>
        </div>
      </Result>
    );
  }

  if (payment.status === "mislukt") {
    return (
      <Result
        tone="danger"
        title="De betaling is niet doorgegaan"
        lead={payment.failureReason ?? "Er is niets van je rekening afgeschreven."}
      >
        <p className="text-sm text-fg-muted">
          Je abonnement is niet gewijzigd en er is niets aangerekend. Probeer het opnieuw, of kies
          een andere betaalmethode.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={ROUTES.billingCheckout(payment.planId)}
            className={buttonClasses("primary", "md")}
          >
            Opnieuw proberen
          </Link>
          <Link href={ROUTES.billing} className={buttonClasses("secondary", "md")}>
            Terug naar facturatie
          </Link>
        </div>
      </Result>
    );
  }

  // Nog onderweg.
  return (
    <Result
      tone="pending"
      title={hasTimedOut ? "Je betaling is nog onderweg" : "We wachten op je bank"}
      lead={
        hasTimedOut
          ? "Dit duurt langer dan gewoonlijk. Bij een domiciliëring is dat normaal: die kan een paar werkdagen onderweg zijn."
          : `Zodra ${method.label} bevestigt, staat ${plan.name} actief.`
      }
    >
      {error ? <Alert variant="warning" title={error} className="mb-4" /> : null}

      <p className="text-sm text-fg-muted">
        Je hoeft hier niet te blijven wachten. We sturen je een e-mail zodra de betaling rond is, en
        je kan Immoreel intussen gewoon gebruiken.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {hasTimedOut ? (
          <Button icon={<RotateCcw />} onClick={check}>
            Opnieuw controleren
          </Button>
        ) : null}
        <Link
          href={ROUTES.billing}
          className={buttonClasses(hasTimedOut ? "secondary" : "primary", "md")}
        >
          Naar facturatie
        </Link>
        <Link href={ROUTES.dashboard} className={buttonClasses("ghost", "md")}>
          Naar het dashboard
        </Link>
      </div>

      {isPolling ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-fg-subtle">
          <Spinner label={null} className="size-3.5" />
          Deze pagina ververst zichzelf.
        </p>
      ) : null}
    </Result>
  );
}

type Tone = "success" | "danger" | "pending";

const TONES = {
  success: { icon: CircleCheck, className: "bg-success-soft text-success" },
  danger: { icon: CircleX, className: "bg-danger-soft text-danger" },
  pending: { icon: Clock, className: "bg-warning-soft text-warning" },
} as const;

function Result({
  tone,
  title,
  lead,
  children,
}: {
  tone: Tone;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  const { icon: Icon, className } = TONES[tone];

  return (
    <Card>
      <CardContent className="pt-6">
        <span
          className={`mb-4 flex size-11 items-center justify-center rounded-full ${className}`}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>

        <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
        <p className="mt-1.5 mb-5 text-sm text-fg-muted">{lead}</p>

        {children}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2 last:border-0">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-medium tabular-nums text-fg">{value}</dd>
    </div>
  );
}
