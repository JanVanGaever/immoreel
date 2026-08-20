import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-surface-inset", className)} {...props} />;
}

export type SkeletonScreenProps = {
  /** Wat een schermlezer hoort terwijl het scherm nog leeg is. */
  label?: string;
  children: ReactNode;
  className?: string;
};

/**
 * De omhulling van een laadscherm.
 *
 * Een scherm vol grijze blokken zegt niets tegen wie het niet ziet. Daarom
 * hangt er één melding aan het geheel — `aria-busy` met een naam — en zijn de
 * blokken zelf verborgen voor de schermlezer: veertig losse vormen voorlezen
 * helpt niemand.
 */
export function SkeletonScreen({
  label = "Bezig met laden",
  children,
  className,
}: SkeletonScreenProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/** De kop van een pagina: een titel met een regel uitleg eronder. */
export function SkeletonPageHeader() {
  return (
    <div className="mb-6 space-y-3 sm:mb-8">
      <Skeleton className="h-7 w-44 sm:w-56" />
      <Skeleton className="h-4 w-full max-w-80" />
    </div>
  );
}
