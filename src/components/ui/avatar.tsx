import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export type AvatarProps = {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "size-7 text-[0.6875rem]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
} as const;

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border border-border bg-surface-subtle font-semibold text-fg-muted select-none",
        sizes[size],
        className,
      )}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
