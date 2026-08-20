"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { createLogger } from "@/lib/errors/logger";
import { toAppError } from "@/lib/errors/normalize";
import type { AppError } from "@/lib/errors/app-error";

const log = createLogger("ui");

/**
 * Een stuk scherm dat mag omvallen zonder de rest mee te nemen.
 *
 * `error.tsx` van Next vangt een fout op paginaniveau; dat is grof. Een
 * voorbeeldspeler die struikelt over een kapotte blob-URL hoort de editor
 * eromheen niet leeg te maken — de gebruiker was aan het monteren, en dat werk
 * staat nog niet op de server.
 *
 * Zet deze rand dus om het deel dat op zichzelf kan falen, niet om alles:
 *
 * ```tsx
 * <ErrorBoundary title="De preview kon niet geladen worden">
 *   <PreviewPlayer plan={plan} />
 * </ErrorBoundary>
 * ```
 *
 * Een klasse en geen hook, omdat React het opvangen van fouten in een render
 * alleen zo aanbiedt.
 */

export type ErrorBoundaryProps = {
  children: ReactNode;
  /** Kop boven de melding. Zonder dit staat de melding van de fout er zelf. */
  title?: string;
  /**
   * Eigen weergave. Krijgt de genormaliseerde fout en een functie om het nog
   * eens te proberen — die wist de fout en rendert de kinderen opnieuw.
   */
  fallback?: (error: AppError, reset: () => void) => ReactNode;
  /** Voor wie er meer mee wil doen dan loggen, bijvoorbeeld een teller. */
  onError?: (error: AppError) => void;
};

type State = { error: AppError | null };

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: toAppError(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    const failure = toAppError(error);

    log.error("component gaf een fout in zijn render", failure, {
      // De boomstructuur waarin het misging; zonder die regel zoek je in de
      // gebundelde code naar een component zonder naam.
      componentStack: info.componentStack ?? undefined,
    });

    this.props.onError?.(failure);
  }

  private readonly reset = () => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return <ErrorState error={error} title={this.props.title} onRetry={this.reset} />;
  }
}
