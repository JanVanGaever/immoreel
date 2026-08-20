"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ErrorSummary } from "@/components/ui/error-state";
import { Avatar } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { initialAccountState } from "@/lib/account/action-state";
import { updateNameAction } from "@/lib/account/actions";
import type { User } from "@/types";

export type ProfileFormProps = { user: User };

/**
 * Je naam. Meer staat er niet in dit formulier: het e-mailadres is je login
 * en heeft daarom een eigen kaart met een eigen bevestiging.
 *
 * De naam is wat je collega's zien staan bij een project en in het team, dus
 * de avatar staat ernaast — je ziet meteen wat er verandert.
 */
export function ProfileForm({ user }: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateNameAction, initialAccountState);
  const [name, setName] = useState(user.name);

  const saved = state.values?.name ?? user.name;
  const changed = name.trim() !== saved.trim();

  return (
    <Card>
      <form action={action} noValidate>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Je naam</CardTitle>
            <CardDescription>
              Zo sta je bij je collega&apos;s in het team en bij je projecten.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {state.status === "gelukt" && state.message ? (
            <Alert variant="success" title={state.message} />
          ) : null}
          {state.status === "fout" && state.message ? (
            <ErrorSummary error={state.message} />
          ) : null}

          <div className="flex items-center gap-4">
            <Avatar name={name || user.name} src={user.avatarUrl} size="lg" />
            <FormField label="Naam" error={state.fieldErrors?.name} required className="flex-1">
              <Input
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jan Janssens"
              />
            </FormField>
          </div>
        </CardContent>

        <CardFooter>
          <Button
            type="submit"
            isLoading={pending}
            loadingLabel="Bezig"
            disabled={!changed || pending}
          >
            Naam opslaan
          </Button>
          {!changed ? <span className="text-xs text-fg-subtle">Niets gewijzigd</span> : null}
        </CardFooter>
      </form>
    </Card>
  );
}
