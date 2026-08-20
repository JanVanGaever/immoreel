"use client";

import { MoreHorizontal, ShieldCheck, UserMinus } from "lucide-react";
import { RoleBadge } from "@/components/team/role-badge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import {
  checkRemoval,
  checkRoleChange,
  type TeamActor,
  type TeamCheck,
} from "@/lib/team/rules";
import { ROLES } from "@/lib/auth/roles";
import type { TeamMember } from "@/types";

export type MemberListProps = {
  members: TeamMember[];
  /** Wie er kijkt; bepaalt "Jij" en wat er in het menu staat. */
  actor: TeamActor;
  ownerCount: number;
  canManage: boolean;
  onChangeRole: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
};

/**
 * De collega's van het kantoor.
 *
 * Het menu per rij staat er alleen voor wie het team beheert, en wat daarin
 * niet kan, staat uitgeschakeld mét de reden als tooltip. Een menu-item
 * verbergen zou de vraag "waarom kan ik mezelf niet verwijderen?" onbeantwoord
 * laten; uitgeschakeld met uitleg beantwoordt ze.
 */
export function MemberList({
  members,
  actor,
  ownerCount,
  canManage,
  onChangeRole,
  onRemove,
}: MemberListProps) {
  return (
    <ul className="divide-y divide-border">
      {members.map((member) => {
        const target = { membershipId: member.membershipId, role: member.role };
        const isYou = member.membershipId === actor.membershipId;

        // Rol wijzigen kan zodra er één andere rol overblijft die mag. Kan er
        // geen enkele, dan is de eerste weigering meteen de uitleg.
        const roleChecks = ROLES.filter((role) => role !== member.role).map((role) =>
          checkRoleChange(actor, target, role, ownerCount),
        );
        const roleChange: TeamCheck = roleChecks.find((check) => check.allowed) ??
          roleChecks[0] ?? { allowed: false };

        const removal = checkRemoval(actor, target, ownerCount);

        return (
          <li key={member.membershipId} className="flex items-center gap-3 py-3">
            <Avatar name={member.user.name} src={member.user.avatarUrl} />

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-fg">
                <span className="truncate">{member.user.name}</span>
                {isYou ? (
                  <Badge variant="neutral" size="sm">
                    Jij
                  </Badge>
                ) : null}
              </p>
              <p className="truncate text-xs text-fg-subtle">{member.user.email}</p>
            </div>

            <span className="hidden shrink-0 text-xs text-fg-subtle sm:block">
              Sinds {formatDate(member.joinedAt)}
            </span>

            <RoleBadge role={member.role} />

            {canManage ? (
              <DropdownMenu
                align="end"
                trigger={
                  <IconButton
                    label={`Acties voor ${member.user.name}`}
                    variant="ghost"
                    size="icon-sm"
                  >
                    <MoreHorizontal />
                  </IconButton>
                }
              >
                <DropdownMenuItem
                  icon={<ShieldCheck />}
                  disabled={!roleChange.allowed}
                  title={roleChange.reason}
                  onSelect={() => onChangeRole(member)}
                >
                  Rol wijzigen
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<UserMinus />}
                  destructive
                  disabled={!removal.allowed}
                  title={removal.reason}
                  onSelect={() => onRemove(member)}
                >
                  Uit het team verwijderen
                </DropdownMenuItem>
              </DropdownMenu>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
