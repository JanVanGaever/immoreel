import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TeamPanel } from "@/components/team/team-panel";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { getBillingStore } from "@/db/billing-store";
import { getTeamStore } from "@/db/team-store";
import { ROLE_LABELS, can } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { PLAN_LIMITS, getPlan } from "@/lib/billing/plans";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Team" };

/**
 * Het team van het kantoor.
 *
 * Iedereen mag kijken: weten wie er meewerkt en wie waarvoor te porren is,
 * hoort bij het werk. Uitnodigen, rollen aanpassen en verwijderen is aan de
 * eigenaar — `members:manage` — en dat wordt hier bepaald én opnieuw in elke
 * serveractie. De pagina is dus niet het slot, alleen de deurklink.
 */
export default async function TeamPage() {
  const { organisation, role, membershipId } = await requireSession();
  const canManage = can(role, "members:manage");

  const store = getTeamStore();
  const [members, invitations, subscription] = await Promise.all([
    store.listMembers(organisation.id),
    store.listInvitations(organisation.id),
    getBillingStore().getSubscription(organisation.id),
  ]);

  const plan = getPlan(subscription.planId);

  return (
    <>
      <PageHeader
        title="Team"
        description={`Wie werkt er mee aan de video's van ${organisation.name}, en wat mag elk van hen?`}
        actions={
          <Link href={ROUTES.settings} className={buttonClasses("secondary", "md")}>
            <ArrowLeft />
            Instellingen
          </Link>
        }
      />

      {!canManage ? (
        <Alert variant="info" title={`Je rol is ${ROLE_LABELS[role]}.`} className="mb-6">
          Je ziet wie er bij het kantoor hoort en met welke rol. Uitnodigen, rollen aanpassen en
          collega&apos;s verwijderen doet een {ROLE_LABELS.owner.toLowerCase()}.
        </Alert>
      ) : null}

      <TeamPanel
        members={members}
        invitations={invitations}
        actor={{ role, membershipId }}
        organisationName={organisation.name}
        planName={plan.name}
        seats={{
          seats: PLAN_LIMITS[subscription.planId].seats,
          members: members.length,
          pendingInvitations: invitations.length,
        }}
      />
    </>
  );
}
