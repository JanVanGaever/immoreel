"use client";

import type { ComponentProps, ReactNode } from "react";
import { controlBase, controlSizes, type ControlSize } from "@/components/ui/control";
import { useFieldProps } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type InputProps = Omit<ComponentProps<"input">, "size"> & {
  inputSize?: ControlSize;
  /** Icoon links in het veld, bijvoorbeeld een vergrootglas bij zoeken. */
  leadingIcon?: ReactNode;
  /** Icoon of knop rechts in het veld. */
  trailingIcon?: ReactNode;
};

export function Input({
  inputSize = "md",
  leadingIcon,
  trailingIcon,
  className,
  ...rest
}: InputProps) {
  const props = useFieldProps(rest);

  const input = (
    <input
      className={cn(
        controlBase,
        controlSizes[inputSize],
        leadingIcon && "pl-9",
        trailingIcon && "pr-9",
        className,
      )}
      {...props}
    />
  );

  if (!leadingIcon && !trailingIcon) return input;

  return (
    <div className="relative">
      {leadingIcon ? (
        <span className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 text-fg-subtle [&_svg]:size-4">
          {leadingIcon}
        </span>
      ) : null}
      {input}
      {trailingIcon ? (
        <span className="absolute top-1/2 right-3 flex -translate-y-1/2 text-fg-subtle [&_svg]:size-4">
          {trailingIcon}
        </span>
      ) : null}
    </div>
  );
}

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({ className, ...rest }: TextareaProps) {
  const props = useFieldProps(rest);

  return <textarea className={cn(controlBase, "min-h-24 px-3 py-2", className)} {...props} />;
}
