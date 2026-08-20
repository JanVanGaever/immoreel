"use client";

import { useActionState, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { initialAccountState } from "@/lib/account/action-state";
import { deleteAccountAction } from "@/lib/account/actions";
import type { AccountCheck } from "@/lib/account/rules";

export type DeleteAccountCardProps = {
  email: string;
  organisationName: string;
  /** Verdwijnt het kantoor mee? Alleen als je de laatste bent. */
  organisationLeaves: boolean;
  /** Mag het, en zo niet: waarom niet. Komt uit `checkAccountDeletion()`. */
  check: AccountCheck;
  hasPassword: boolean;
};

/**
 * Je account verwijderen.
 *
 * Wat er tegenhoudt, staat er vóór de knop — niet erna. Kan het niet omdat je
 * de laatste eigenaar bent of omdat er nog een abonnement loopt, dan staat de
 * knop grijs met die reden erbij; dat is iets wat je zelf kan oplossen, en dan
 * hoort het geen foutmelding te zijn maar een instructie.
 *
 * Kan het wel, dan volgt een venster dat drie dingen vraagt: lezen wat er
 * verdwijnt, je e-mailadres overtypen en je wachtwoord. Overtypen is er niet
 * om het moeilijk te maken maar om het traag te maken: een klik is zo gebeurd,
 * een adres overtypen niet.
 */
export function DeleteAccountCard({
  email,
  organisationName,
  organisationLeaves,
  check,
  hasPassword,
}: DeleteAccountCardProps) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccountAction, initialAccountState);
  const [typed, setTyped] = useState("");

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  function close() {
    if (pending) return;

    setTyped("");
    setOpen(false);
  }

  return (
    <>
      <Card className="border-danger/30">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-danger">
              <TriangleAlert aria-hidden="true" className="size-4" />
              Account verwijderen
            </CardTitle>
            <CardDescription>
              Onomkeerbaar. Je komt daarna niet meer in {organisationName}.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <ul className="space-y-1.5 text-sm text-fg-muted">
            <li>· Je login verdwijnt: inloggen kan meteen daarna niet meer.</li>
            <li>· Je naam verdwijnt uit het team van {organisationName}.</li>
            {organisationLeaves ? (
              <li className="text-danger">
                · Je bent de laatste in dit kantoor, dus {organisationName} verdwijnt mee.
              </li>
            ) : (
              <li>· De projecten en video&apos;s die je maakte, blijven van het kantoor.</li>
            )}
          </ul>

          {!check.allowed ? (
            <Alert variant="warning" title="Dit kan nu nog niet.">
              {check.reason}
            </Alert>
          ) : null}
        </CardContent>

        <CardFooter>
          <Button
            variant="danger"
            icon={<Trash2 />}
            onClick={() => setOpen(true)}
            disabled={!check.allowed}
            title={check.reason}
          >
            Account verwijderen
          </Button>
          <span className="text-xs text-fg-subtle">
            Vraagt je e-mailadres{hasPassword ? " en je wachtwoord" : ""}
          </span>
        </CardFooter>
      </Card>

      <Modal open={open} onClose={close} size="sm" closeOnBackdropClick={false}>
        <ModalHeader
          title="Weet je het zeker?"
          description="Dit kunnen we niet ongedaan maken."
          showClose={!pending}
        />

        <form action={action} noValidate>
          <ModalBody className="space-y-4">
            {state.status === "fout" && state.message ? (
              <ErrorSummary error={state.message} />
            ) : null}

            {organisationLeaves ? (
              <Alert variant="danger" title={`${organisationName} verdwijnt mee.`}>
                Je bent de laatste in dit kantoor. Alles wat eronder hangt — projecten,
                video&apos;s, huisstijl — is daarna niet meer op te vragen.
              </Alert>
            ) : null}

            <FormField
              label="Typ je e-mailadres over"
              hint={email}
              error={state.fieldErrors?.confirmation}
              required
            >
              <Input
                name="confirmation"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={email}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoFocus
              />
            </FormField>

            {hasPassword ? (
              <FormField
                label="Je wachtwoord"
                error={state.fieldErrors?.password}
                required
              >
                <PasswordInput name="password" autoComplete="current-password" />
              </FormField>
            ) : null}
          </ModalBody>

          <ModalFooter>
            <Button variant="secondary" onClick={close} disabled={pending}>
              Nee, behouden
            </Button>
            <Button
              type="submit"
              variant="danger"
              icon={<Trash2 />}
              isLoading={pending}
              loadingLabel="Bezig met verwijderen"
              disabled={!matches || pending}
            >
              Definitief verwijderen
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
