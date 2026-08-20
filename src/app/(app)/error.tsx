"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { ROUTES } from "@/lib/constants";
import { fromShape } from "@/lib/errors/app-error";
import { createLogger } from "@/lib/errors/logger";
import { toAppError } from "@/lib/errors/normalize";

const log = createLogger("app-error");

/**
 * Wat er staat als een pagina omvalt.
 *
 * Next geeft hier een gewone `Error` door, met soms een `digest` erbij — de
 * hash waaronder de serverfout in de logs staat. Die twee dingen horen bij
 * elkaar: de gebruiker ziet een verwijzing, wij hebben er een in het logboek,
 * en die zijn aan elkaar te knopen. Zonder dat is "er ging iets mis bij het
 * openen van mijn projecten" niet te onderzoeken.
 *
 * De fout zelf wordt genormaliseerd tot een `AppError` (zie `src/lib/errors`),
 * zodat deze pagina er hetzelfde uitziet als elke andere foutmelding in de app.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const failure = toAppError(error, { fallback: "server-error" });

  // De digest is de verwijzing die iets waard is: daaronder staat de fout in de
  // serverlogs. Een vers verzonnen `errorId` zou hier alleen in de browser
  // bestaan, en dan verwijst de gebruiker naar iets wat wij niet kunnen opzoeken.
  const shown = error.digest
    ? fromShape({ ...failure.toShape(), errorId: error.digest })
    : failure;

  useEffect(() => {
    log.error("pagina kon niet geladen worden", failure, { digest: error.digest });
    // Aan de fout zelf hangen en niet aan `failure`: dat is elke render een
    // nieuw object, en dezelfde fout hoort één regel in het logboek te zijn.
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ErrorState
      error={shown}
      onRetry={reset}
      action={
        <Link href={ROUTES.dashboard} className={buttonClasses("ghost", "md")}>
          Naar het dashboard
        </Link>
      }
    />
  );
}
