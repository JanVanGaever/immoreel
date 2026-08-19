"use client";

import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";
import { useFieldProps } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type ChoiceProps = Omit<ComponentProps<"input">, "type"> & {
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
};

const boxBase =
  "col-start-1 row-start-1 size-[1.125rem] appearance-none border border-border-strong bg-surface " +
  "shadow-soft transition-[background-color,border-color] duration-150 " +
  "checked:border-brand checked:bg-brand " +
  "disabled:cursor-not-allowed disabled:opacity-55";

function Choice({
  type,
  label,
  description,
  className,
  ...rest
}: ChoiceProps & { type: "checkbox" | "radio" }) {
  const props = useFieldProps(rest);
  const isRadio = type === "radio";

  return (
    <label
      className={cn(
        "flex items-start gap-2.5 text-sm",
        props.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative grid shrink-0 place-items-center pt-0.5">
        <input
          type={type}
          className={cn(boxBase, isRadio ? "rounded-full" : "rounded-[0.3125rem]", "peer")}
          {...props}
        />
        {isRadio ? (
          <span className="pointer-events-none col-start-1 row-start-1 size-1.5 rounded-full bg-brand-fg opacity-0 peer-checked:opacity-100" />
        ) : (
          <Check
            aria-hidden="true"
            className="pointer-events-none col-start-1 row-start-1 size-3 text-brand-fg opacity-0 peer-checked:opacity-100"
          />
        )}
      </span>

      {label || description ? (
        <span className="leading-tight">
          {label ? <span className="font-medium text-fg">{label}</span> : null}
          {description ? <span className="mt-1 block text-xs text-fg-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

export type CheckboxProps = ChoiceProps;
export type RadioProps = ChoiceProps;

export function Checkbox(props: CheckboxProps) {
  return <Choice type="checkbox" {...props} />;
}

export function Radio(props: RadioProps) {
  return <Choice type="radio" {...props} />;
}

/** Groepeert radio's of checkboxes met een gedeeld label. */
export function ChoiceGroup({
  legend,
  className,
  children,
  ...props
}: ComponentProps<"fieldset"> & { legend?: ReactNode }) {
  return (
    <fieldset className={cn("flex flex-col gap-2.5", className)} {...props}>
      {legend ? <legend className="mb-1 text-sm font-medium text-fg">{legend}</legend> : null}
      {children}
    </fieldset>
  );
}
