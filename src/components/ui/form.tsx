import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Opmaak van formulieren: dezelfde ritmiek voor auth, editor en facturatie.
 * De componenten regelen alleen indeling en spacing, geen state of validatie.
 */
export function Form({ className, ...props }: ComponentProps<"form">) {
  return <form className={cn("flex flex-col gap-8", className)} {...props} />;
}

export type FormSectionProps = ComponentProps<"section"> & {
  title?: ReactNode;
  description?: ReactNode;
};

export function FormSection({ title, description, className, children, ...props }: FormSectionProps) {
  return (
    <section className={cn("flex flex-col gap-4", className)} {...props}>
      {title || description ? (
        <div>
          {title ? <h3 className="text-sm font-semibold tracking-tight text-fg">{title}</h3> : null}
          {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type FormRowProps = ComponentProps<"div"> & {
  /** Aantal kolommen vanaf `sm`; daaronder staat alles onder elkaar. */
  columns?: 1 | 2 | 3;
};

export function FormRow({ columns = 2, className, ...props }: FormRowProps) {
  const columnClasses = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
  } as const;

  return <div className={cn("grid grid-cols-1 gap-4", columnClasses[columns], className)} {...props} />;
}

/** Knoppenrij onderaan een formulier; primaire actie rechts. */
export function FormActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
