import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { buttonClasses } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { formatBytes, formatNumber } from "@/lib/format";
import { capacityTone, formatPeriodLabel, remaining, usageTone } from "@/lib/dashboard";
import type { UsageSummary } from "@/types";

export type UsageCardProps = {
  usage: UsageSummary;
  className?: string;
};

/** "4 / 5" of "4 · onbeperkt" als er geen limiet is. */
function limitLabel(used: number, included: number, unit?: string): string {
  const usedLabel = formatNumber(used);
  if (included <= 0) return `${usedLabel}${unit ? ` ${unit}` : ""} · onbeperkt`;

  return `${usedLabel} / ${formatNumber(included)}${unit ? ` ${unit}` : ""}`;
}

/** Verbruik van de lopende maand: renders, opslag en gebruikers. */
export function UsageCard({ usage, className }: UsageCardProps) {
  const rendersLeft = remaining(usage.rendersUsed, usage.rendersIncluded);
  const rendersTone = usageTone(usage.rendersUsed, usage.rendersIncluded);

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Verbruik deze maand</CardTitle>
          <CardDescription className="capitalize">{formatPeriodLabel(usage)}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Meter
            label="Renders"
            valueLabel={limitLabel(usage.rendersUsed, usage.rendersIncluded)}
            value={usage.rendersUsed}
            max={usage.rendersIncluded}
            tone={rendersTone}
          />
          <p className="mt-1.5 text-xs text-fg-subtle">
            {usage.rendersIncluded <= 0
              ? "Onbeperkt renderen in dit plan."
              : rendersLeft > 0
                ? `Nog ${formatNumber(rendersLeft)} renders inbegrepen tot het einde van de maand.`
                : "Je inbegrepen renders zijn op. Extra renders worden apart aangerekend."}
          </p>
        </div>

        <Meter
          label="Opslag"
          valueLabel={`${formatBytes(usage.storageUsedInBytes)} / ${formatBytes(usage.storageIncludedInBytes)}`}
          value={usage.storageUsedInBytes}
          max={usage.storageIncludedInBytes}
          tone={usageTone(usage.storageUsedInBytes, usage.storageIncludedInBytes)}
        />

        <Meter
          label="Gebruikers"
          valueLabel={limitLabel(usage.seatsUsed, usage.seatsIncluded)}
          value={usage.seatsUsed}
          max={usage.seatsIncluded}
          tone={capacityTone(usage.seatsUsed, usage.seatsIncluded)}
        />

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-sm text-fg-muted">Gerenderde video&apos;s</span>
          <span className="text-sm font-medium tabular-nums text-fg">
            {formatNumber(usage.renderMinutesUsed)} min
          </span>
        </div>

        <Link href={ROUTES.billing} className={buttonClasses("secondary", "sm", "w-full")}>
          Verbruik en facturen
        </Link>
      </CardContent>
    </Card>
  );
}
