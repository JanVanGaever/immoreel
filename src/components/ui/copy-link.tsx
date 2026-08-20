"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CopyLinkProps = {
  url: string;
  className?: string;
};

/**
 * Een link die op het scherm staat om zelf door te sturen, met een
 * kopieerknop ernaast.
 *
 * Gebruikt voor uitnodigingen en voor het bevestigen van een nieuw
 * e-mailadres. Van zulke tokens bewaren we alleen de hash, dus de link is
 * hierna nergens meer op te vragen — daarom staat ze meteen na het aanvragen
 * op het scherm. Dat is geen noodoplossing voor de ontbrekende
 * e-mailprovider alleen: een mail die in de spam belandt is de gewoonste zaak,
 * en dan is "plak deze link in WhatsApp" sneller dan opnieuw versturen.
 */
export function CopyLink({ url, className }: CopyLinkProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Zonder toestemming voor het klembord blijft de link zichtbaar: dan
      // selecteert de gebruiker ze zelf. Een foutmelding helpt hier niemand.
      setCopied(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-subtle p-1.5 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg-muted" title={url}>
          {url}
        </code>
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? <Check /> : <Copy />}
          onClick={copy}
          aria-live="polite"
        >
          {copied ? "Gekopieerd" : "Kopieer"}
        </Button>
      </div>
    </div>
  );
}
