"use client";

import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import type { TeamActionState } from "@/lib/team/action-state";
import { removeMemberAction } from "@/lib/team/actions";
import type { TeamMember } from "@/types";

export type RemoveMemberModalProps = {
  member: TeamMember | null;
  organisationName: string;
  onClose: () => void;
  onDone: (state: TeamActionState) => void;
};

/**
 * Bevestiging vóór het verwijderen.
 *
 * De tekst zegt wat er echt gebeurt — de collega raakt er niet meer in, zijn
 * projecten blijven staan — want dat is de vraag die iemand op dit moment
 * heeft. "Weet je het zeker?" beantwoordt ze niet.
 */
export function RemoveMemberModal({
  member,
  organisationName,
  onClose,
  onDone,
}: RemoveMemberModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!member) return null;

  function remove() {
    if (!member) return;

    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(member.membershipId);

      if (result.status === "fout") {
        setError(result.message ?? "Verwijderen kan niet.");
        return;
      }

      onDone(result);
      onClose();
    });
  }

  return (
    <Modal open={Boolean(member)} onClose={onClose} size="sm">
      <ModalHeader
        title={`${member.user.name} verwijderen?`}
        description={`Deze collega hoort daarna niet meer bij ${organisationName}.`}
      />

      <ModalBody className="space-y-3">
        {error ? <Alert variant="danger" title={error} /> : null}

        <p className="text-sm text-fg-muted">
          Bij zijn volgende klik ligt de app er voor hem uit — ook als hij nu nog ingelogd is.
          De projecten en video&apos;s die hij maakte, blijven van je kantoor.
        </p>
        <p className="text-sm text-fg-muted">
          Van gedacht veranderd? Nodig hem gewoon opnieuw uit op hetzelfde adres: hij krijgt
          dan zijn eigen account terug.
        </p>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuleren
        </Button>
        <Button
          variant="danger"
          icon={<UserMinus />}
          onClick={remove}
          isLoading={pending}
          loadingLabel="Bezig met verwijderen"
        >
          Verwijderen
        </Button>
      </ModalFooter>
    </Modal>
  );
}
