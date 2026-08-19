import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Step = {
  id: string;
  label: string;
  description?: string;
};

export type StepsProps = {
  steps: Step[];
  /** Index van de stap waar de gebruiker nu staat (0-gebaseerd). */
  current: number;
  orientation?: "horizontal" | "vertical";
  /** Maakt afgeronde stappen aanklikbaar, bijvoorbeeld in een wizard. */
  onStepSelect?: (index: number) => void;
  label?: string;
  className?: string;
};

/** Voortgangsindicator voor meerstapsflows: upload, montage, publiceren. */
export function Steps({
  steps,
  current,
  orientation = "horizontal",
  onStepSelect,
  label = "Voortgang",
  className,
}: StepsProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <nav aria-label={label} className={className}>
      <ol className={cn("flex", isHorizontal ? "items-start gap-2" : "flex-col")}>
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          const clickable = Boolean(onStepSelect) && complete;
          const isLast = index === steps.length - 1;

          const marker = (
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                "transition-colors duration-150",
                complete && "border-brand bg-brand text-brand-fg",
                active && "border-brand bg-brand-soft text-brand",
                !complete && !active && "border-border bg-surface text-fg-subtle",
              )}
            >
              {complete ? <Check aria-hidden="true" className="size-4" /> : index + 1}
            </span>
          );

          const markerNode = clickable ? (
            <button
              type="button"
              onClick={() => onStepSelect?.(index)}
              className="rounded-full"
              aria-label={`Terug naar stap ${index + 1}: ${step.label}`}
            >
              {marker}
            </button>
          ) : (
            marker
          );

          const text = (
            <span className={cn("min-w-0", isHorizontal && "mt-2 block")}>
              <span
                className={cn(
                  "block text-sm font-medium",
                  active || complete ? "text-fg" : "text-fg-muted",
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="mt-0.5 block text-xs text-fg-subtle">{step.description}</span>
              ) : null}
            </span>
          );

          const connector = isLast ? null : (
            <span
              aria-hidden="true"
              className={cn(
                complete ? "bg-brand" : "bg-border",
                isHorizontal ? "h-px flex-1" : "w-px flex-1",
              )}
            />
          );

          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={cn(
                "min-w-0",
                isHorizontal ? "flex flex-1 flex-col" : "flex gap-3 pb-6 last:pb-0",
              )}
            >
              {isHorizontal ? (
                <span className="flex items-center gap-2">
                  {markerNode}
                  {connector}
                </span>
              ) : (
                <span className="flex flex-col items-center gap-1 self-stretch">
                  {markerNode}
                  {connector}
                </span>
              )}
              {text}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
