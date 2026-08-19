import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/** Woordmerk + beeldmerk. Vervang de SVG zodra het definitieve logo er is. */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-fg">
        <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden="true" fill="none">
          <path
            d="M3 10.2 12 3.5l9 6.7V20a.5.5 0 0 1-.5.5h-5.2V14H8.7v6.5H3.5A.5.5 0 0 1 3 20v-9.8Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M10.6 8.6 14.4 11l-3.8 2.4V8.6Z" fill="currentColor" />
        </svg>
      </span>
      {showWordmark ? (
        <span className="text-[0.9375rem] font-semibold tracking-tight text-fg">{APP_NAME}</span>
      ) : null}
    </span>
  );
}
