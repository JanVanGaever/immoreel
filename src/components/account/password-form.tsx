"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { ErrorSummary } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/field";
import { initialAccountState } from "@/lib/account/action-state";
import { changePasswordAction } from "@/lib/account/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";

export type PasswordFormProps = {
  /** `false` voor wie tot nu toe alleen met een magic link binnenkwam. */
  hasPassword: boolean;
};

/**
 * Wachtwoord wijzigen — of voor het eerst instellen.
 *
 * Wie er al een heeft, geeft het huidige mee: een openstaand tabblad op een
 * gedeelde computer mag niet genoeg zijn om iemand buiten te sluiten. Wie er
 * nog geen heeft (binnengekomen via een magic link) kan er ook geen bewijzen;
 * die stelt er hier gewoon een in, met dezelfde toegang als waarmee hij zou
 * inloggen.
 *
 * Het wachtwoord vergeten terwijl je ingelogd bent? Dan is uitloggen en de
 * herstelmail de weg; dat staat onder de knop.
 */
export function PasswordForm({ hasPassword }: PasswordFormProps) {
  const [state, action, pending] = useActionState(changePasswordAction, initialAccountState);
  const saved = state.status === "gelukt";

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{hasPassword ? "Wachtwoord wijzigen" : "Wachtwoord instellen"}</CardTitle>
          <CardDescription>
            {hasPassword
              ? "Kies een wachtwoord dat je nergens anders gebruikt."
              : "Je logt nu in met een e-maillink. Met een wachtwoord gaat het sneller."}
          </CardDescription>
        </div>
      </CardHeader>

      {/* React 19 maakt een formulier met een action-functie zelf weer leeg na
          het versturen; de wachtwoordvelden blijven dus niet ingevuld staan. */}
      <form action={action} noValidate>
        <CardContent className="space-y-4">
          {saved && state.message ? <Alert variant="success" title={state.message} /> : null}
          {state.status === "fout" && state.message ? (
            <ErrorSummary error={state.message} />
          ) : null}

          {hasPassword ? (
            <FormField
              label="Huidig wachtwoord"
              error={state.fieldErrors?.currentPassword}
              required
            >
              <PasswordInput name="currentPassword" autoComplete="current-password" />
            </FormField>
          ) : null}

          <FormField
            label="Nieuw wachtwoord"
            hint={`Minstens ${PASSWORD_MIN_LENGTH} tekens, met een letter en een cijfer.`}
            error={state.fieldErrors?.password}
            required
          >
            <PasswordInput name="password" autoComplete="new-password" />
          </FormField>

          <FormField
            label="Herhaal het nieuwe wachtwoord"
            error={state.fieldErrors?.passwordConfirmation}
            required
          >
            <PasswordInput name="passwordConfirmation" autoComplete="new-password" />
          </FormField>
        </CardContent>

        <CardFooter>
          <Button type="submit" icon={<KeyRound />} isLoading={pending} loadingLabel="Bezig">
            {hasPassword ? "Wachtwoord wijzigen" : "Wachtwoord instellen"}
          </Button>
          {hasPassword ? (
            <span className="text-xs text-fg-subtle">
              {/* `/forgot-password` is alleen voor wie uitgelogd is (zie
                  GUEST_ONLY_ROUTES); daarom een zin en geen link die
                  terugkaatst naar het dashboard. */}
              Huidig wachtwoord kwijt? Log uit en kies &quot;Wachtwoord vergeten&quot;.
            </span>
          ) : null}
        </CardFooter>
      </form>
    </Card>
  );
}
