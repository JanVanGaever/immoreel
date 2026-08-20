"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Info, UserPlus } from "lucide-react";
import { ChangeRoleModal } from "@/components/team/change-role-modal";
import { InvitationList } from "@/components/team/invitation-list";
import { InviteLink } from "@/components/team/invite-link";
import { InviteMemberModal } from "@/components/team/invite-member-modal";
import { MemberList } from "@/components/team/member-list";
import { RemoveMemberModal } from "@/components/team/remove-member-modal";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { ROUTES } from "@/lib/constants";
import { initialTeamState, type TeamActionState } from "@/lib/team/action-state";
import {
  canManageTeam,
  checkInvite,
  countOwners,
  hasSeatLeft,
  seatsAreUnlimited,
  seatsInUse,
  type SeatUsage,
  type TeamActor,
} from "@/lib/team/rules";
import type { InvitationSummary, TeamMember } from "@/types";

export type TeamPanelProps = {
  members: TeamMember[];
  invitations: InvitationSummary[];
  /** Wie er kijkt: zijn rol en zijn eigen lidmaatschap. */
  actor: TeamActor;
  organisationName: string;
  seats: SeatUsage;
  planName: string;
};

/**
 * Het teamscherm: leden, uitnodigingen en de vensters ertussen.
 *
 * De pagina eromheen haalt de gegevens op en beslist wat er getoond mag
 * worden; dit paneel houdt bij welk venster openstaat en wat de laatste
 * handeling opleverde. Na elke geslaagde actie roept het `router.refresh()`
 * aan: de lijst komt van de server, dus die moet het laatste woord hebben.
 */
export function TeamPanel({
  members,
  invitations,
  actor,
  organisationName,
  seats,
  planName,
}: TeamPanelProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<TeamActionState>(initialTeamState);
  const [inviting, setInviting] = useState(false);
  const [changingRoleFor, setChangingRoleFor] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const canManage = canManageTeam(actor.role);
  const ownerCount = countOwners(members);
  const invite = checkInvite(actor.role, seats);
  const used = seatsInUse(seats);

  function handleDone(state: TeamActionState) {
    setFeedback(state);
    if (state.status === "gelukt") router.refresh();
  }

  return (
    <>
      {feedback.status !== "idle" && feedback.message ? (
        <Alert
          variant={feedback.status === "gelukt" ? "success" : "danger"}
          title={feedback.message}
          className="mb-6"
        >
          {feedback.inviteUrl ? <InviteLink url={feedback.inviteUrl} className="mt-2" /> : null}
        </Alert>
      ) : null}

      {canManage && !hasSeatLeft(seats) ? (
        <Alert variant="warning" title="Alle plaatsen van je plan zijn bezet" className="mb-6">
          <p>
            {planName} heeft {seats.seats} {seats.seats === 1 ? "plaats" : "plaatsen"}. Maak er
            één vrij, of ga naar een groter plan om meer collega&apos;s toe te laten.
          </p>
          <Link
            href={ROUTES.billing}
            className={buttonClasses("secondary", "sm", "mt-2.5 text-fg")}
          >
            Plannen bekijken
          </Link>
        </Alert>
      ) : null}

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Teamleden</CardTitle>
              <CardDescription>
                {members.length} {members.length === 1 ? "collega" : "collega's"} in{" "}
                {organisationName}, {ownerCount}{" "}
                {ownerCount === 1
                  ? ROLE_LABELS.owner.toLowerCase()
                  : `${ROLE_LABELS.owner.toLowerCase()}s`}
                .
              </CardDescription>
            </div>

            {canManage ? (
              <Button
                icon={<UserPlus />}
                onClick={() => setInviting(true)}
                disabled={!invite.allowed}
                title={invite.reason}
              >
                Collega uitnodigen
              </Button>
            ) : null}
          </CardHeader>

          <CardContent>
            <MemberList
              members={members}
              actor={actor}
              ownerCount={ownerCount}
              canManage={canManage}
              onChangeRole={setChangingRoleFor}
              onRemove={setRemoving}
            />

            <Meter
              className="mt-5"
              value={used}
              max={seatsAreUnlimited(seats) ? 0 : seats.seats}
              tone={!seatsAreUnlimited(seats) && used >= seats.seats ? "warning" : "brand"}
              label={`Plaatsen in ${planName}`}
              valueLabel={
                seatsAreUnlimited(seats) ? `${used} · onbeperkt` : `${used} / ${seats.seats}`
              }
            />
            {seats.pendingInvitations > 0 ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-subtle">
                <Info aria-hidden="true" className="size-3.5" />
                Openstaande uitnodigingen tellen mee zolang ze geldig zijn.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {invitations.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Uitgenodigd</CardTitle>
                <CardDescription>
                  Nog niet binnen. Een uitnodiging blijft zeven dagen geldig.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <InvitationList
                invitations={invitations}
                canManage={canManage}
                onDone={handleDone}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {canManage ? (
        <>
          <InviteMemberModal
            open={inviting}
            onClose={() => setInviting(false)}
            organisationName={organisationName}
          />
          <ChangeRoleModal
            // Nieuwe collega = nieuwe modal: zo begint de keuze bij zijn
            // huidige rol zonder een effect dat de staat terugzet.
            key={`rol-${changingRoleFor?.membershipId ?? "geen"}`}
            member={changingRoleFor}
            actor={actor}
            ownerCount={ownerCount}
            onClose={() => setChangingRoleFor(null)}
            onDone={handleDone}
          />
          <RemoveMemberModal
            key={`verwijderen-${removing?.membershipId ?? "geen"}`}
            member={removing}
            organisationName={organisationName}
            onClose={() => setRemoving(null)}
            onDone={handleDone}
          />
        </>
      ) : null}
    </>
  );
}
