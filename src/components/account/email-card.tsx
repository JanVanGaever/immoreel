"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, MailCheck, ShieldCheck } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { ErrorSummary } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyLink } from "@/components/ui/copy-link";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { initialAccountState } from "@/lib/account/action-state";
import { cancelEmailChangeAction, requestEmailChangeAction } from "@/lib/account/actions";
import { formatRelativeTime } from "@/lib/format";
import type { PendingEmailChange, User } from "@/types";

export type EmailCardProps = {
  user: User;
  /** Een aanvraag die nog bevestigd moet worden op het nieuwe adres. */
  pending: PendingEmailChange | null;
  /** `false` voor wie via een magic link binnenkwam en nog geen wachtwoord heeft. */
  hasPassword: boolean;
};

/**
 * Je e-mailadres — en dat is ook je login, wat dit meteen de gevoeligste
 * instelling op de pagina maakt.
 *
 * Daarom in twee stappen: hier vraag je het aan (met je wachtwoord erbij), en
 * pas de klik op de link in de nieuwe mailbox laat het adres wisselen. Zolang
 * die klik uitblijft, blijft alles zoals het was en zegt de kaart dat ook.
 */
export function EmailCard({ user, pending, hasPassword }: EmailCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, submitting] = useActionState(
    requestEmailChangeAction,
    initialAccountState,
  );
  const [cancelling, startCancel] = useTransition();
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const requested = state.status === "gelukt";

  useEffect(() => {
    // De kaart hierboven toont het aangevraagde adres; dat komt van de server.
    if (requested) router.refresh();
  }, [requested, router]);

  function close() {
    setOpen(false);
  }

  function cancel() {
    setCancelMessage(null);
    startCancel(async () => {
      const result = await cancelEmailChangeAction();
      setCancelMessage(result.message ?? null);
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>E-mailadres</CardTitle>
            <CardDescription>Hiermee log je in en hierop krijg je meldingen.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {cancelMessage ? <Alert variant="success" title={cancelMessage} /> : null}

          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-fg-subtle"
            >
              <AtSign className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{user.email}</p>
              <p className="mt-0.5 text-xs text-fg-subtle">Je huidige adres</p>
            </div>
            <Badge variant="success" size="sm" className="ml-auto shrink-0">
              <ShieldCheck aria-hidden="true" className="size-3" />
              In gebruik
            </Badge>
          </div>

          {pending ? (
            <Alert variant="warning" title={`Nog te bevestigen: ${pending.email}`}>
              <p>
                We stuurden een link naar dat adres. Zolang er niet op geklikt is, blijft{" "}
                {user.email} je login. De link verloopt {formatRelativeTime(pending.expiresAt)}.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpen(true)}
                  className="text-fg"
                >
                  Opnieuw versturen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancel}
                  isLoading={cancelling}
                  loadingLabel="Bezig"
                >
                  Aanvraag intrekken
                </Button>
              </div>
            </Alert>
          ) : null}
        </CardContent>

        <CardFooter>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            E-mailadres wijzigen
          </Button>
          <span className="text-xs text-fg-subtle">
            {hasPassword ? "Vraagt je wachtwoord" : "Vraagt een bevestiging per mail"}
          </span>
        </CardFooter>
      </Card>

      <Modal open={open} onClose={close} closeOnBackdropClick={false}>
        <ModalHeader
          title="Ander e-mailadres"
          description="Je adres wisselt pas als je op de link in de nieuwe mailbox klikt."
        />

        {requested ? (
          <>
            <ModalBody className="space-y-4">
              <Alert
                variant={state.emailDelivered ? "success" : "warning"}
                title={state.message}
              >
                {state.emailDelivered
                  ? "Tot dan blijf je inloggen met je huidige adres."
                  : "Open de link hieronder zelf om de wijziging af te ronden."}
              </Alert>

              {state.confirmUrl ? (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-fg">De bevestigingslink</p>
                  <CopyLink url={state.confirmUrl} />
                  <p className="mt-1.5 text-xs text-fg-subtle">
                    Eén uur geldig, en werkt één keer.
                  </p>
                </div>
              ) : null}
            </ModalBody>

            <ModalFooter>
              <Button icon={<MailCheck />} onClick={close}>
                Klaar
              </Button>
            </ModalFooter>
          </>
        ) : (
          <form action={action} noValidate>
            <ModalBody className="space-y-4">
              {state.status === "fout" && state.message ? (
                <ErrorSummary error={state.message} />
              ) : null}

              <Alert variant="info" title="Dit is ook je login.">
                Na de bevestiging log je in met het nieuwe adres. Kijk dus even na of het klopt.
              </Alert>

              <FormField
                label="Nieuw e-mailadres"
                error={state.fieldErrors?.email}
                required
              >
                <Input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="jij@kantoor.be"
                  defaultValue={state.values?.email}
                  autoFocus
                />
              </FormField>

              {hasPassword ? (
                <FormField
                  label="Je huidige wachtwoord"
                  hint="Om zeker te zijn dat jij het bent."
                  error={state.fieldErrors?.password}
                  required
                >
                  <PasswordInput name="password" autoComplete="current-password" />
                </FormField>
              ) : null}
            </ModalBody>

            <ModalFooter>
              <Button variant="secondary" onClick={close} disabled={submitting}>
                Annuleren
              </Button>
              <Button
                type="submit"
                isLoading={submitting}
                loadingLabel="Bezig met versturen"
              >
                Bevestiging versturen
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </>
  );
}
