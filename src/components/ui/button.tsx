import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 " +
  "disabled:pointer-events-none disabled:opacity-55 " +
  "aria-disabled:pointer-events-none aria-disabled:opacity-55 " +
  "[&_svg]:size-4 [&_svg]:shrink-0";

export const buttonVariants = {
  primary: "bg-brand text-brand-fg shadow-soft hover:bg-brand-hover",
  secondary:
    "border border-border bg-surface text-fg shadow-soft hover:border-border-strong hover:bg-surface-subtle",
  ghost: "text-fg-muted hover:bg-surface-subtle hover:text-fg",
  danger: "bg-danger text-white shadow-soft hover:opacity-90",
} as const;

export const buttonSizes = {
  sm: "h-[var(--control-sm)] gap-1.5 px-3 text-[0.8125rem]",
  md: "h-[var(--control-md)] px-4 text-sm",
  lg: "h-[var(--control-lg)] px-5 text-sm",
  icon: "size-[var(--control-md)]",
  "icon-sm": "size-[var(--control-sm)]",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

/**
 * Voor elementen die als knop tonen maar geen `<button>` zijn,
 * bijvoorbeeld `<Link className={buttonClasses("secondary", "sm")}>`.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Toont een spinner, blokkeert klikken en zet `aria-busy`. */
  isLoading?: boolean;
  /** Tekst die schermlezers horen tijdens het laden. */
  loadingLabel?: string;
  /** Icoon vóór de tekst; wordt tijdens het laden vervangen door de spinner. */
  icon?: ReactNode;
};

export function Button({
  variant,
  size,
  isLoading = false,
  loadingLabel = "Bezig",
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? isLoading}
      aria-busy={isLoading || undefined}
      className={buttonClasses(
        variant,
        size,
        cn(isLoading && "cursor-wait disabled:opacity-100", className),
      )}
      {...props}
    >
      {isLoading ? <Spinner label={loadingLabel} /> : icon}
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "children" | "icon"> & {
  /** Verplicht: een icoonknop heeft geen zichtbare tekst. */
  label: string;
  children: ReactNode;
};

/** Icoonknop die je dwingt een toegankelijke naam mee te geven. */
export function IconButton({ label, size = "icon", children, ...props }: IconButtonProps) {
  return (
    <Button size={size} aria-label={label} title={label} {...props}>
      {children}
    </Button>
  );
}
