"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { ErrorSummary } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialAuthState } from "@/lib/auth/action-state";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialAuthState);

  // Na een geslaagde aanvraag verdwijnt het formulier: opnieuw indienen heeft
  // toch geen zin, en zo is duidelijk dat er iets gebeurd is.
  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success" title="Kijk in je mailbox">
          {state.message}
        </Alert>
        <p className="text-sm text-fg-muted">
          Geen mail gekregen? Controleer of je het juiste adres gebruikte en probeer het over een
          paar minuten opnieuw.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && state.message ? (
        <ErrorSummary error={state.message} />
      ) : null}

      <FormField
        label="E-mailadres"
        hint="We sturen je een link waarmee je een nieuw wachtwoord instelt."
        error={state.fieldErrors?.email}
        required
      >
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="jij@kantoor.be"
          defaultValue={state.values?.email}
          autoFocus
        />
      </FormField>

      <Button type="submit" isLoading={pending} loadingLabel="Bezig met versturen" className="w-full">
        Stuur herstellink
      </Button>
    </form>
  );
}
