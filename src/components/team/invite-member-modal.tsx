"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, Send } from "lucide-react";
import { InviteLink } from "@/components/team/invite-link";
import { RolePicker } from "@/components/team/role-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { initialTeamState } from "@/lib/team/action-state";
import { inviteMemberAction } from "@/lib/team/actions";
import type { Role } from "@/types";

export type InviteMemberModalProps = {
  open: boolean;
  onClose: () => void;
  organisationName: string;
  /** Rol die voorgevinkt staat; een collega is meestal editor. */
  defaultRole?: Role;
};

/**
 * Uitnodigen in één scherm: adres, rol, versturen.
 *
 * Na het versturen blijft het venster open met de link erin. Dat is bewust:
 * de link bestaat daarna nergens meer (we bewaren alleen de hash), dus dit is
 * het enige moment om ze te kopiëren. "Nog iemand uitnodigen" zet het
 * formulier weer leeg, want wie één collega toevoegt, voegt er meestal twee
 * toe.
 */
export function InviteMemberModal({
  open,
  onClose,
  organisationName,
  defaultRole = "editor",
}: InviteMemberModalProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(inviteMemberAction, initialTeamState);
  const [role, setRole] = useState<Role>(defaultRole);
  // Eén teller: verandert ze, dan tekent React het formulier opnieuw en staan
  // de velden leeg — zonder dat we elk veld apart moeten resetten.
  const [formKey, setFormKey] = useState(0);

  const sent = state.status === "gelukt";

  useEffect(() => {
    // De lijst met openstaande uitnodigingen staat op de server; die moet
    // meteen kloppen, ook al blijft dit venster openstaan.
    if (sent) router.refresh();
  }, [sent, router]);

  function reset() {
    setRole(defaultRole);
    setFormKey((value) => value + 1);
  }

  return (
    <Modal open={open} onClose={onClose} closeOnBackdropClick={false}>
      <ModalHeader
        title="Collega uitnodigen"
        description={`Hij of zij komt binnen bij ${organisationName} met de rol die je hier kiest.`}
      />

      {sent ? (
        <>
          <ModalBody className="space-y-4">
            <Alert
              variant={state.emailDelivered ? "success" : "warning"}
              title={state.message}
              showIcon
            >
              {state.emailDelivered
                ? "De link is zeven dagen geldig en werkt één keer."
                : "Stuur de link hieronder zelf door. Ze is zeven dagen geldig."}
            </Alert>

            {state.inviteUrl ? (
              <div>
                <p className="mb-1.5 text-sm font-medium text-fg">De uitnodigingslink</p>
                <InviteLink url={state.inviteUrl} />
                <p className="mt-1.5 text-xs text-fg-subtle">
                  Straks niet meer op te vragen: we bewaren alleen een versleutelde versie.
                  Kwijt? Stuur de uitnodiging opnieuw.
                </p>
              </div>
            ) : null}
          </ModalBody>

          <ModalFooter>
            <Button variant="secondary" icon={<Send />} onClick={reset}>
              Nog iemand uitnodigen
            </Button>
            <Button icon={<MailCheck />} onClick={onClose}>
              Klaar
            </Button>
          </ModalFooter>
        </>
      ) : (
        <form key={formKey} action={action} noValidate>
          <ModalBody className="space-y-5">
            {state.status === "fout" && state.message ? (
              <Alert variant="danger" title={state.message} />
            ) : null}

            <FormField
              label="E-mailadres"
              hint="Hier komt de uitnodiging toe."
              error={state.fieldErrors?.email}
              required
            >
              <Input
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="collega@kantoor.be"
                defaultValue={state.values?.email}
                autoFocus
              />
            </FormField>

            {/* Geen FormField: een radiogroep hoort in een fieldset met een
                legend, niet onder één label dat naar één control wijst. */}
            <div>
              <RolePicker
                name="role"
                legend="Rol"
                value={role}
                onChange={setRole}
                disabled={pending}
              />
              {state.fieldErrors?.role ? (
                <FieldError className="mt-1.5">{state.fieldErrors.role}</FieldError>
              ) : null}
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Annuleren
            </Button>
            <Button
              type="submit"
              icon={<Send />}
              isLoading={pending}
              loadingLabel="Uitnodiging wordt verstuurd"
            >
              Uitnodiging versturen
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
