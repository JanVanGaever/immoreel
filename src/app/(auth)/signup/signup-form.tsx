"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialAuthState } from "@/lib/auth/action-state";
import { signUpAction } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, initialAuthState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert variant="danger" title={state.message} />
      ) : null}

      <FormField label="Je naam" error={state.fieldErrors?.name} required>
        <Input
          name="name"
          autoComplete="name"
          placeholder="Jan Janssens"
          defaultValue={state.values?.name}
          autoFocus
        />
      </FormField>

      <FormField
        label="Naam van je kantoor"
        hint="Hieronder komen je panden, projecten en facturen te staan."
        error={state.fieldErrors?.organisation}
        required
      >
        <Input
          name="organisation"
          autoComplete="organization"
          placeholder="Vastgoedkantoor Janssens"
          defaultValue={state.values?.organisation}
        />
      </FormField>

      <FormField label="E-mailadres" error={state.fieldErrors?.email} required>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="jij@kantoor.be"
          defaultValue={state.values?.email}
        />
      </FormField>

      <FormField
        label="Wachtwoord"
        hint={`Minstens ${PASSWORD_MIN_LENGTH} tekens, met een letter en een cijfer.`}
        error={state.fieldErrors?.password}
        required
      >
        <PasswordInput name="password" autoComplete="new-password" />
      </FormField>

      <div>
        <Checkbox
          name="terms"
          label="Ik ga akkoord met de voorwaarden en de privacyverklaring."
          aria-invalid={state.fieldErrors?.terms ? true : undefined}
        />
        {state.fieldErrors?.terms ? (
          <FieldError className="mt-1.5">{state.fieldErrors.terms}</FieldError>
        ) : null}
      </div>

      <Button
        type="submit"
        isLoading={pending}
        loadingLabel="Account wordt aangemaakt"
        className="w-full"
      >
        Account aanmaken
      </Button>
    </form>
  );
}
