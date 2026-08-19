"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { initialAuthState } from "@/lib/auth/action-state";
import { resetPasswordAction } from "@/lib/auth/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialAuthState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.status === "error" && state.message ? (
        <Alert variant="danger" title={state.message} />
      ) : null}

      <FormField
        label="Nieuw wachtwoord"
        hint={`Minstens ${PASSWORD_MIN_LENGTH} tekens, met een letter en een cijfer.`}
        error={state.fieldErrors?.password}
        required
      >
        <PasswordInput name="password" autoComplete="new-password" autoFocus />
      </FormField>

      <FormField
        label="Herhaal je wachtwoord"
        error={state.fieldErrors?.passwordConfirmation}
        required
      >
        <PasswordInput name="passwordConfirmation" autoComplete="new-password" />
      </FormField>

      <Button type="submit" isLoading={pending} loadingLabel="Bezig met opslaan" className="w-full">
        Wachtwoord instellen
      </Button>
    </form>
  );
}
