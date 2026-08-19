"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  id?: string;
  className?: string;
};

/**
 * Aan/uit-schakelaar voor instellingen die meteen effect hebben.
 * Voor formulieren die je opslaat met een knop past `Checkbox` beter.
 */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  label,
  description,
  id,
  className,
}: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const labelId = `${switchId}-label`;
  const descriptionId = `${switchId}-description`;

  const [internal, setInternal] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const isOn = isControlled ? checked : internal;

  function toggle() {
    const next = !isOn;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  }

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={isOn}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full",
          "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55",
          isOn ? "bg-brand" : "bg-border-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block size-4 rounded-full bg-white shadow-soft transition-transform duration-150",
            isOn ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </button>

      {label || description ? (
        <span className="text-sm leading-tight">
          {label ? (
            <label id={labelId} htmlFor={switchId} className="font-medium text-fg">
              {label}
            </label>
          ) : null}
          {description ? (
            <span id={descriptionId} className="mt-1 block text-xs text-fg-muted">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
