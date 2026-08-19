import { cn } from "@/lib/utils";

export type SpinnerProps = {
  /** Tekst voor schermlezers; verberg met `label={null}` als de context al duidelijk is. */
  label?: string | null;
  className?: string;
};

export function Spinner({ label = "Bezig", className }: SpinnerProps) {
  return (
    <>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn("size-4 animate-spin", className)}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}
