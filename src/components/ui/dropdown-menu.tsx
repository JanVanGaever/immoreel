"use client";

import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type DropdownMenuContextValue = {
  close: () => void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

const MENU_ITEM_SELECTOR = "[role=menuitem]:not([data-disabled])";

export type DropdownMenuProps = {
  /** Een knop; krijgt automatisch aria-haspopup, aria-expanded en de klikafhandeling. */
  trigger: ReactElement<ComponentProps<"button">>;
  align?: "start" | "end";
  children: ReactNode;
  className?: string;
};

/**
 * Menu met roving focus volgens het WAI-ARIA menu-button pattern:
 * pijltjes navigeren, Escape sluit en zet de focus terug op de knop.
 */
export function DropdownMenu({ trigger, align = "start", children, className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function focusTrigger() {
    containerRef.current?.querySelector("button")?.focus();
  }

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR)?.focus();
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      if (event.key === "Escape") {
        event.preventDefault();
        focusTrigger();
      }
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) ?? [],
    );
    if (items.length === 0) return;

    const currentIndex = items.findIndex((item) => item === document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    event.preventDefault();
    items[nextIndex]?.focus();
  }

  const triggerElement = cloneElement(trigger, {
    "aria-haspopup": "menu",
    "aria-expanded": open,
    onClick: (event: Parameters<NonNullable<ComponentProps<"button">["onClick"]>>[0]) => {
      trigger.props.onClick?.(event);
      setOpen((value) => !value);
    },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      trigger.props.onKeyDown?.(event);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
    },
  });

  return (
    <div ref={containerRef} className="relative inline-block">
      {triggerElement}

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className={cn(
            "absolute top-[calc(100%+0.375rem)] z-50 min-w-52 rounded-lg border border-border",
            "bg-surface p-1 shadow-elevated",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          <DropdownMenuContext.Provider value={{ close }}>{children}</DropdownMenuContext.Provider>
        </div>
      ) : null}
    </div>
  );
}

export type DropdownMenuItemProps = Omit<ComponentProps<"button">, "onSelect"> & {
  /** Wordt aangeroepen bij klik of Enter; het menu sluit daarna vanzelf. */
  onSelect?: () => void;
  icon?: ReactNode;
  /** Rode variant voor verwijderen en andere onomkeerbare acties. */
  destructive?: boolean;
};

export function DropdownMenuItem({
  onSelect,
  icon,
  destructive = false,
  disabled = false,
  className,
  children,
  ...props
}: DropdownMenuItemProps) {
  const context = useContext(DropdownMenuContext);

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      data-disabled={disabled || undefined}
      onClick={() => {
        onSelect?.();
        context?.close();
      }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm",
        "transition-colors duration-100 focus:outline-none",
        "disabled:pointer-events-none disabled:opacity-55",
        destructive
          ? "text-danger hover:bg-danger-soft focus-visible:bg-danger-soft"
          : "text-fg hover:bg-surface-subtle focus-visible:bg-surface-subtle",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-subtle",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("px-2.5 pt-2 pb-1 text-[0.6875rem] font-semibold tracking-wider text-fg-subtle uppercase", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<"div">) {
  return <div role="separator" className={cn("my-1 h-px bg-border", className)} {...props} />;
}
