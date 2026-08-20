import type { ExportPreset } from "@/types";
import { aspectRatioCss } from "@/lib/aspect-ratios";
import { cn } from "@/lib/utils";

/**
 * De veilige zone van een preset, op ware verhouding.
 *
 * Getallen als "de onderste 30%" zeggen weinig; een kadertje met een gearceerde
 * rand zegt het meteen. Dit is puur beeld — dezelfde fracties die hier een
 * `inset` worden, gaan later als coördinaten naar de preview van de editor.
 */
export function SafeAreaFrame({
  preset,
  className,
}: {
  preset: ExportPreset;
  className?: string;
}) {
  const { safeArea } = preset;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block w-10 shrink-0 overflow-hidden rounded-[0.25rem] border border-border bg-surface-subtle",
        className,
      )}
      style={{ aspectRatio: aspectRatioCss(preset.aspectRatio) }}
    >
      <span
        className="absolute rounded-[0.125rem] border border-dashed border-brand/70 bg-brand-soft/40"
        style={{
          top: `${safeArea.topFraction * 100}%`,
          right: `${safeArea.rightFraction * 100}%`,
          bottom: `${safeArea.bottomFraction * 100}%`,
          left: `${safeArea.leftFraction * 100}%`,
        }}
      />
    </span>
  );
}
