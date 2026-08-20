"use client";

import { useState, useTransition } from "react";
import { Mail, MoreHorizontal, Send, X } from "lucide-react";
import { RoleBadge } from "@/components/team/role-badge";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { formatRelativeTime } from "@/lib/format";
import type { TeamActionState } from "@/lib/team/action-state";
import { resendInvitationAction, revokeInvitationAction } from "@/lib/team/actions";
import {
  INVITATION_STATUS_LABELS,
  INVITATION_STATUS_VARIANTS,
} from "@/lib/team/invitations";
import type { ID, InvitationSummary } from "@/types";

export type InvitationListProps = {
  invitations: InvitationSummary[];
  canManage: boolean;
  onDone: (state: TeamActionState) => void;
};

/**
 * Wie er uitgenodigd is maar nog niet binnen.
 *
 * Twee acties, en allebei doen ze precies wat ze zeggen: opnieuw versturen
 * maakt een nieuwe link (de oude werkt dan niet meer), intrekken sluit de deur.
 * De rij zelf verdwijnt pas als de server het bevestigt — `router.refresh()`
 * in het paneel hierboven.
 */
export function InvitationList({ invitations, canManage, onDone }: InvitationListProps) {
  const [busyId, setBusyId] = useState<ID | null>(null);
  const [, startTransition] = useTransition();

  function run(invitationId: ID, action: (id: ID) => Promise<TeamActionState>) {
    setBusyId(invitationId);

    startTransition(async () => {
      const result = await action(invitationId);

      setBusyId(null);
      onDone(result);
    });
  }

  return (
    <ul className="divide-y divide-border">
      {invitations.map((invitation) => (
        <li key={invitation.id} className="flex items-center gap-3 py-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-fg-subtle"
          >
            <Mail className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{invitation.email}</p>
            <p className="truncate text-xs text-fg-subtle">
              {invitation.invitedByName ? `Uitgenodigd door ${invitation.invitedByName} · ` : ""}
              Verloopt {formatRelativeTime(invitation.expiresAt)}
            </p>
          </div>

          <Badge variant={INVITATION_STATUS_VARIANTS[invitation.status]} size="sm" dot>
            {INVITATION_STATUS_LABELS[invitation.status]}
          </Badge>

          <RoleBadge role={invitation.role} />

          {canManage ? (
            busyId === invitation.id ? (
              <span className="flex size-[var(--control-sm)] items-center justify-center">
                <Spinner label="Bezig" />
              </span>
            ) : (
              <DropdownMenu
                align="end"
                trigger={
                  <IconButton
                    label={`Acties voor de uitnodiging van ${invitation.email}`}
                    variant="ghost"
                    size="icon-sm"
                  >
                    <MoreHorizontal />
                  </IconButton>
                }
              >
                <DropdownMenuItem
                  icon={<Send />}
                  onSelect={() => run(invitation.id, resendInvitationAction)}
                >
                  Opnieuw versturen
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<X />}
                  destructive
                  onSelect={() => run(invitation.id, revokeInvitationAction)}
                >
                  Uitnodiging intrekken
                </DropdownMenuItem>
              </DropdownMenu>
            )
          ) : null}
        </li>
      ))}
    </ul>
  );
}
