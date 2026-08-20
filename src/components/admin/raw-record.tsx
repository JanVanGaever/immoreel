"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export type RawRecordProps = {
  /** De rij zoals ze opgeslagen staat. Wordt hier pas naar JSON omgezet. */
  value: unknown;
  title?: string;
};

/**
 * De ruwe rij, met een kopieerknop.
 *
 * Support kan hiermee de volledige stand van een job of project in een ticket
 * plakken zonder tussenpersoon: geen "kun je een screenshot sturen", maar de
 * echte velden, met de echte namen die ook in de code staan. Dat is wat een
 * ontwikkelaar nodig heeft om zonder tweede ronde te kunnen antwoorden.
 *
 * Het staat ingeklapt, want negen van de tien keer is het antwoord al te lezen
 * in de velden erboven.
 */
export function RawRecord({ value, title = "Ruwe rij" }: RawRecordProps) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(value, null, 2);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      // Zonder toestemming voor het klembord blijft de tekst zichtbaar; dan
      // selecteert de gebruiker ze zelf. Een foutmelding helpt hier niemand.
      setCopied(false);
    }
  }

  return (
    <details className="rounded-xl border border-border bg-surface">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold tracking-tight">
        {title}
      </summary>
      <div className="border-t border-border p-4">
        <div className="mb-3 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            icon={copied ? <Check /> : <Copy />}
            onClick={copy}
            aria-live="polite"
          >
            {copied ? "Gekopieerd" : "Kopieer JSON"}
          </Button>
        </div>
        <pre className="max-h-96 overflow-auto rounded-lg bg-surface-inset p-4 font-mono text-xs text-fg-muted">
          {json}
        </pre>
      </div>
    </details>
  );
}
