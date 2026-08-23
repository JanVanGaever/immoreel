"use client";

import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type TabsVariant = "line" | "pill";

type TabsContextValue = {
  value: string;
  select: (value: string) => void;
  baseId: string;
  variant: TabsVariant;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`${component} moet binnen <Tabs> gebruikt worden.`);
  return context;
}

export type TabsProps = {
  /** Gecontroleerd gebruik; laat weg en gebruik `defaultValue` voor lokale state. */
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  children: ReactNode;
  className?: string;
};

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  variant = "line",
  children,
  className,
}: TabsProps) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const active = isControlled ? value : internal;

  function select(next: string) {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  }

  return (
    <TabsContext.Provider value={{ value: active, select, baseId, variant }}>
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

/** Pijltjestoetsen verplaatsen de focus tussen tabs (WAI-ARIA tabs pattern). */
export function TabsList({ className, children, ...props }: ComponentProps<"div">) {
  const { variant } = useTabsContext("TabsList");
  const listRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    const selector = "[role=tab]:not(:disabled)";
    const tabs = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(selector) ?? []);
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;

    const next = tabs[nextIndex];
    if (!next) return;

    event.preventDefault();
    next.focus();
    next.click();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn(
        // `scroll-x`: op een smal scherm schuift de rij opzij in plaats van
        // te breken, en de scrollbalk zelf blijft weg — die kost meer hoogte
        // dan de tabs eronder waard zijn.
        "scroll-x flex items-center gap-1",
        variant === "line" ? "border-b border-border" : "w-fit rounded-lg bg-surface-subtle p-1",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type TabsTriggerProps = ComponentProps<"button"> & { value: string };

export function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
  const { value: active, select, baseId, variant } = useTabsContext("TabsTrigger");
  const selected = active === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => select(value)}
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap",
        "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        // Een tab is een van de grootste knoppen op het scherm en hoort niet
        // de kleinste te zijn om aan te tikken.
        "min-h-[var(--control-md)]",
        variant === "line"
          ? cn(
              "-mb-px border-b-2 px-3 py-2.5",
              selected ? "border-brand text-fg" : "border-transparent text-fg-muted hover:text-fg",
            )
          : cn(
              "rounded-md px-3 py-1.5",
              selected ? "bg-surface text-fg shadow-soft" : "text-fg-muted hover:text-fg",
            ),
        className,
      )}
      {...props}
    />
  );
}

export type TabsContentProps = ComponentProps<"div"> & { value: string };

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const { value: active, baseId } = useTabsContext("TabsContent");
  const selected = active === value;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={cn("focus-visible:outline-none", className)}
      {...props}
    >
      {selected ? children : null}
    </div>
  );
}
