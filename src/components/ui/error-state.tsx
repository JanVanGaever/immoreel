"use client";

import type { ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AppError, isAppError } from "@/lib/errors/app-error";
import { cn } from "@/lib/utils";
import type { AppErrorShape, FieldErrors } from "@/types/error";

/**
 * Hoe een fout eruitziet.
 *
 * Drie vormen, en het verschil is hoeveel er stuk is:
 *
 * - `ErrorAlert` — één ding ging mis, de rest van het scherm werkt nog. Een
 *   upload die faalt, een export die niet gerenderd raakte.
 * - `ErrorState` — er valt hier niets te tonen. Een paneel of een pagina die
 *   zijn gegevens niet kreeg.
 * - `ErrorSummary` — een formulier is afgewezen. Zegt wat er in het geheel
 *   misging én welke velden het betreft, want die staan soms buiten beeld.
 *
 * Alle drie eten ze hetzelfde: een `AppError`, een `AppErrorShape`, of gewoon
 * een string voor een melding die (nog) geen code heeft. Dat is met opzet — een
 * component dat een fout wil tonen, hoort niet eerst te moeten weten uit welke
 * laag ze komt.
 *
 * **De knop hoort bij de fout, niet bij het scherm.** Of "Opnieuw proberen"
 * verschijnt, beslist het retrybeleid uit de catalogus. Een knop die drie keer
 * dezelfde fout oplevert, is erger dan geen knop: hij belooft dat het aan het
 * toeval lag.
 *
 * **De techniek staat er wel, maar niet in de weg.** De foutcode is altijd
 * zichtbaar (dat is wat een klant doorbelt); de volledige detailregel staat in
 * een dichtgeklapt blokje, en alleen buiten productie — daar staat de fout van
 * de laag eronder in, en die is voor developers.
 */

/** Alles wat een scherm als fout kan binnenkrijgen. */
export type DisplayableError = AppError | AppErrorShape | string;

type Display = {
  code: string | null;
  message: string;
  hint: string | null;
  fields: FieldErrors | null;
  errorId: string | null;
  detail: string | null;
  severity: "warning" | "error";
  retryable: boolean;
};

/** Eén vorm om op te tekenen, wat er ook binnenkwam. */
function toDisplay(error: DisplayableError): Display {
  if (typeof error === "string") {
    return {
      code: null,
      message: error,
      hint: null,
      fields: null,
      errorId: null,
      detail: null,
      severity: "error",
      retryable: false,
    };
  }

  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.message,
      hint: error.hint,
      fields: error.fields,
      errorId: error.errorId,
      detail: error.detail,
      severity: error.severity,
      retryable: error.retryable,
    };
  }

  return {
    code: error.code,
    message: error.message,
    hint: error.hint,
    fields: error.fields,
    errorId: error.errorId,
    detail: error.detail ?? null,
    severity: error.severity,
    retryable: error.retry.mode !== "none",
  };
}

/** Buiten productie is de detailregel nuttig; erin is ze ruis voor de klant. */
const showDetailsByDefault = process.env.NODE_ENV !== "production";

export type ErrorAlertProps = {
  error: DisplayableError;
  /** Zonder deze functie verschijnt er geen knop, ook niet bij een retrybare fout. */
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  /** Overschrijft de zin uit de catalogus, bijvoorbeeld met wat er nu gebeurt. */
  hint?: ReactNode;
  showDetails?: boolean;
  className?: string;
};

/**
 * Een fout naast het ding dat stuk is. Compact genoeg voor in een kaart, met
 * de knop erbij als opnieuw proberen zin heeft.
 */
export function ErrorAlert({
  error,
  onRetry,
  retryLabel = "Opnieuw proberen",
  isRetrying = false,
  hint,
  showDetails = showDetailsByDefault,
  className,
}: ErrorAlertProps) {
  const display = toDisplay(error);
  const guidance = hint ?? display.hint;

  return (
    <Alert
      variant={display.severity === "warning" ? "warning" : "danger"}
      title={display.message}
      className={className}
    >
      {guidance ? <p>{guidance}</p> : null}

      {display.fields ? <FieldList fields={display.fields} /> : null}

      {onRetry && display.retryable ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2.5"
          icon={<RotateCcw />}
          isLoading={isRetrying}
          loadingLabel={retryLabel}
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      ) : null}

      <ErrorReference display={display} showDetails={showDetails} />
    </Alert>
  );
}

export type ErrorStateProps = {
  error: DisplayableError;
  /** Kop boven de melding; standaard de melding zelf. */
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
  /** Extra uitweg naast de knop: een link naar een overzicht, bijvoorbeeld. */
  action?: ReactNode;
  showDetails?: boolean;
  className?: string;
};

/**
 * Een fout in plaats van een scherm. Zelfde vorm als `EmptyState`, zodat "hier
 * staat niets" en "hier ging iets mis" niet twee verschillende pagina's lijken.
 */
export function ErrorState({
  error,
  title,
  onRetry,
  retryLabel = "Opnieuw proberen",
  isRetrying = false,
  action,
  showDetails = showDetailsByDefault,
  className,
}: ErrorStateProps) {
  const display = toDisplay(error);

  return (
    <EmptyState
      icon={TriangleAlert}
      title={title ?? display.message}
      description={title ? display.message : (display.hint ?? undefined)}
      className={className}
      action={
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onRetry && display.retryable ? (
              <Button
                variant="secondary"
                icon={<RotateCcw />}
                isLoading={isRetrying}
                loadingLabel={retryLabel}
                onClick={onRetry}
              >
                {retryLabel}
              </Button>
            ) : null}
            {action}
          </div>

          <ErrorReference display={display} showDetails={showDetails} centered />
        </div>
      }
    />
  );
}

export type ErrorSummaryProps = {
  error: DisplayableError;
  /**
   * De veldfouten, als ze niet in de fout zelf zitten.
   *
   * De serveracties in deze app geven hun fouten terug als
   * `{ message, fieldErrors }` (zie de `action-state.ts`-bestanden). Met deze
   * prop past dat rechtstreeks, zonder er eerst een fout van te moeten maken:
   *
   * ```tsx
   * <ErrorSummary error={state.message} fields={state.fieldErrors} />
   * ```
   */
  fields?: FieldErrors;
  /**
   * Nederlandse labels per veldnaam: `{ email: "E-mailadres" }`. Zonder dit
   * staat de veldnaam er zoals de server hem kent, en dat leest als code.
   */
  labels?: Record<string, string>;
  showDetails?: boolean;
  className?: string;
};

/**
 * De melding boven een formulier.
 *
 * De velden staan er nog eens bij, en dat is geen herhaling: bij een lang
 * formulier — de wizard, de huisstijl, de editor — staat het veld dat misging
 * buiten beeld, en dan is "kijk de gemarkeerde velden na" een zoekopdracht.
 */
export function ErrorSummary({
  error,
  fields,
  labels,
  showDetails,
  className,
}: ErrorSummaryProps) {
  const display = toDisplay(error);
  const allFields = fields ?? display.fields;

  return (
    <Alert
      variant={display.severity === "warning" ? "warning" : "danger"}
      title={display.message}
      className={className}
    >
      {display.hint ? <p>{display.hint}</p> : null}
      {allFields ? <FieldList fields={allFields} labels={labels} /> : null}
      <ErrorReference display={display} showDetails={showDetails ?? showDetailsByDefault} />
    </Alert>
  );
}

function FieldList({ fields, labels }: { fields: FieldErrors; labels?: Record<string, string> }) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;

  return (
    <ul className="mt-1.5 space-y-0.5">
      {entries.map(([name, message]) => (
        <li key={name}>
          <span className="font-medium">{labels?.[name] ?? name}</span> — {message}
        </li>
      ))}
    </ul>
  );
}

/**
 * De verwijzing voor support en, buiten productie, de technische regel.
 *
 * De code en de `errorId` staan er altijd: dat is precies wat iemand overtypt
 * uit een screenshot, en waarmee de logregel van dit voorval terug te vinden
 * is. Wat de laag eronder precies zei, staat dichtgeklapt — een gebruiker hoeft
 * geen `ECONNREFUSED` te lezen om te weten dat het niet aan hem lag.
 */
function ErrorReference({
  display,
  showDetails,
  centered = false,
}: {
  display: Display;
  showDetails: boolean;
  centered?: boolean;
}) {
  if (!display.code && !display.errorId) return null;

  const reference = [display.code, display.errorId].filter(Boolean).join(" · ");

  return (
    <div className={cn("mt-2 text-xs text-fg-subtle", centered && "text-center")}>
      <p className="font-mono">{reference}</p>

      {showDetails && display.detail ? (
        <details className="mt-1">
          <summary className="cursor-pointer select-none underline-offset-2 hover:underline">
            Technische details
          </summary>
          <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-surface-inset p-2 text-left font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap">
            {display.detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
