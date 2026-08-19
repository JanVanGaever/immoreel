"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialAuthState } from "@/lib/auth/action-state";
import { requestMagicLinkAction, signInAction } from "@/lib/auth/actions";
import { AUTH_ROUTES } from "@/lib/auth/config";

export type LoginFormProps = {
  /** Pad waar de gebruiker heen wilde voordat de middleware hem hierheen stuurde. */
  redirectTo?: string;
};

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [state, action, pending] = useActionState(signInAction, initialAuthState);
  const [magicState, magicAction, magicPending] = useActionState(
    requestMagicLinkAction,
    initialAuthState,
  );

  return (
    <Tabs defaultValue="wachtwoord" variant="pill">
      <TabsList className="w-full">
        <TabsTrigger value="wachtwoord" className="flex-1 justify-center">
          Wachtwoord
        </TabsTrigger>
        <TabsTrigger value="magic-link" className="flex-1 justify-center">
          Magic link
        </TabsTrigger>
      </TabsList>

      <TabsContent value="wachtwoord">
        <form action={action} className="flex flex-col gap-4" noValidate>
          {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

          {state.status === "error" && state.message ? (
            <Alert variant="danger" title={state.message} />
          ) : null}

          <FormField label="E-mailadres" error={state.fieldErrors?.email} required>
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

          <FormField label="Wachtwoord" error={state.fieldErrors?.password} required>
            <PasswordInput name="password" autoComplete="current-password" />
          </FormField>

          <div className="-mt-1 flex justify-end">
            <Link
              href={AUTH_ROUTES.forgotPassword}
              className="text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Wachtwoord vergeten?
            </Link>
          </div>

          <Button type="submit" isLoading={pending} loadingLabel="Bezig met inloggen" className="w-full">
            Inloggen
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="magic-link">
        <form action={magicAction} className="flex flex-col gap-4" noValidate>
          {magicState.status === "error" && magicState.message ? (
            <Alert variant="danger" title={magicState.message} />
          ) : null}

          {magicState.status === "success" ? (
            <Alert variant="success" title="Kijk in je mailbox">
              {magicState.message}
            </Alert>
          ) : null}

          <FormField
            label="E-mailadres"
            hint="Je krijgt een link waarmee je zonder wachtwoord inlogt. De link is 15 minuten geldig."
            error={magicState.fieldErrors?.email}
            required
          >
            <Input
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="jij@kantoor.be"
              defaultValue={magicState.values?.email}
            />
          </FormField>

          <Button
            type="submit"
            variant="secondary"
            icon={<Mail />}
            isLoading={magicPending}
            loadingLabel="Bezig met versturen"
            className="w-full"
          >
            Stuur me een inloglink
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
