"use client";

import {
  createContext,
  useContext,
  useId,
  type AriaAttributes,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type FieldContextValue = {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export type FieldControlProps = {
  id?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
};

/**
 * Koppelt een control aan het omliggende `FormField`: id, hint, foutmelding
 * en verplicht-status. Zonder FormField blijven de eigen props staan, zodat
 * elke control ook los bruikbaar is.
 */
export function useFieldProps<T extends FieldControlProps>(props: T): T {
  const field = useContext(FieldContext);
  if (!field) return props;

  const describedBy = [field.describedBy, props["aria-describedby"]].filter(Boolean).join(" ");

  return {
    ...props,
    id: props.id ?? field.controlId,
    disabled: props.disabled ?? field.disabled,
    required: props.required ?? field.required,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
  } as T;
}

export type FieldLabelProps = ComponentProps<"label"> & { required?: boolean };

export function FieldLabel({ required = false, className, children, ...props }: FieldLabelProps) {
  return (
    <label className={cn("text-sm font-medium text-fg", className)} {...props}>
      {children}
      {required ? (
        <span className="ml-0.5 text-danger" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

export function FieldHint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-xs text-fg-subtle", className)} {...props} />;
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-xs font-medium text-danger", className)} {...props} />;
}

export type FormFieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  /** Zodra dit gevuld is, is het veld ongeldig: de hint maakt plaats voor de fout. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Standaardopbouw van één formulierveld: label, control, hint of foutmelding.
 * De control eronder pikt id en aria-koppelingen automatisch op.
 */
export function FormField({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  children,
  className,
}: FormFieldProps) {
  const id = useId();
  const controlId = `${id}-control`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);

  return (
    <FieldContext.Provider
      value={{
        controlId,
        describedBy: invalid ? errorId : hint ? hintId : undefined,
        invalid,
        required,
        disabled,
      }}
    >
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label ? (
          <FieldLabel htmlFor={controlId} required={required}>
            {label}
          </FieldLabel>
        ) : null}
        {children}
        {invalid ? (
          <FieldError id={errorId}>{error}</FieldError>
        ) : hint ? (
          <FieldHint id={hintId}>{hint}</FieldHint>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
