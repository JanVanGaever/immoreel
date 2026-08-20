"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { RolePicker } from "@/components/team/role-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";
import type { TeamActionState } from "@/lib/team/action-state";
import { changeMemberRoleAction } from "@/lib/team/actions";
import { checkRoleChange, type TeamActor } from "@/lib/team/rules";
import type { Role, TeamMember } from "@/types";

export type ChangeRoleModalProps = {
  member: TeamMember | null;
  actor: TeamActor;
  ownerCount: number;
  onClose: () => void;
  onDone: (state: TeamActionState) => void;
};

/**
 * De rol van één collega aanpassen.
 *
 * Wat niet mag, staat er als uitgeschakelde keuze mét de reden bij — niet als
 * een knop die pas na het klikken een foutmelding geeft. Dezelfde functie
 * (`checkRoleChange`) bepaalt hier wat er grijs staat en op de server of het
 * doorgaat.
 */
export function ChangeRoleModal({
  member,
  actor,
  ownerCount,
  onClose,
  onDone,
}: ChangeRoleModalProps) {
  const [role, setRole] = useState<Role>(member?.role ?? "viewer");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!member) return null;

  const target = { membershipId: member.membershipId, role: member.role };
  const unavailable: Partial<Record<Role, string>> = {};

  for (const candidate of ROLES) {
    if (candidate === member.role) continue;

    const check = checkRoleChange(actor, target, candidate, ownerCount);
    if (!check.allowed && check.reason) unavailable[candidate] = check.reason;
  }

  const chosen = checkRoleChange(actor, target, role, ownerCount);

  function save() {
    if (!member) return;

    setError(null);
    startTransition(async () => {
      const result = await changeMemberRoleAction(member.membershipId, role);

      if (result.status === "fout") {
        setError(result.message ?? "Deze wijziging kan niet.");
        return;
      }

      onDone(result);
      onClose();
    });
  }

  return (
    <Modal open={Boolean(member)} onClose={onClose}>
      <ModalHeader
        title={`Rol van ${member.user.name}`}
        description={`Nu ${ROLE_LABELS[member.role].toLowerCase()}. Een nieuwe rol gaat meteen in.`}
      />

      <ModalBody className="space-y-4">
        {error ? <Alert variant="danger" title={error} /> : null}

        <RolePicker
          name="member-role"
          value={role}
          onChange={setRole}
          disabled={pending}
          unavailable={unavailable}
        />

        {role === "owner" && member.role !== "owner" ? (
          <Alert variant="warning" title="Een eigenaar kan alles">
            Ook facturatie, het abonnement en dit teamscherm — inclusief jouw rol.
          </Alert>
        ) : null}
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuleren
        </Button>
        <Button
          icon={<ShieldCheck />}
          onClick={save}
          disabled={!chosen.allowed}
          isLoading={pending}
          loadingLabel="Rol wordt aangepast"
        >
          Rol opslaan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
