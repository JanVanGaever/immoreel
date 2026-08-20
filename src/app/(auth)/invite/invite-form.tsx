"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { ErrorSummary } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { initialTeamState } from "@/lib/team/action-state";
import { acceptInvitationAction } from "@/lib/team/actions";

export type InviteFormProps = { token: string };

/**
 * Alleen naam en wachtwoord. Het e-mailadres staat al vast — het is het adres
 * waar de uitnodiging naartoe ging — en het kantoor ook. Dat is meteen het
 * verschil met registreren: daar maak je een kantoor, hier stap je er een
 * binnen.
 */
export function InviteForm({ token }: InviteFormProps) {
  const [state, action, pending] = useActionState(acceptInvitationAction, initialTeamState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.status === "fout" && state.message ? (
        <ErrorSummary error={state.message} />
      ) : null}

      <FormField label="Je naam" error={state.fieldErrors?.name} required>
        <Input
          name="name"
          autoComplete="name"
          placeholder="Sofie Peeters"
          defaultValue={state.values?.name}
          autoFocus
        />
      </FormField>

      <FormField
        label="Kies een wachtwoord"
        hint={`Minstens ${PASSWORD_MIN_LENGTH} tekens, met een letter en een cijfer.`}
        error={state.fieldErrors?.password}
        required
      >
        <PasswordInput name="password" autoComplete="new-password" />
      </FormField>

      <Button
        type="submit"
        isLoading={pending}
        loadingLabel="Je account wordt afgewerkt"
        className="w-full"
      >
        Uitnodiging aanvaarden
      </Button>
    </form>
  );
}
