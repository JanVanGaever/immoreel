import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  QuickLinksCard,
  RecentProjectsCard,
  StatusOverview,
  SubscriptionCard,
  UsageCard,
  WelcomeCard,
} from "@/components/dashboard";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { getDashboardStore } from "@/db/dashboard-store";
import { can } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { subscriptionNeedsAction } from "@/lib/billing";
import { loadSubscription } from "@/lib/billing/service";
import { ROUTES } from "@/lib/constants";
import { isNewOrganisation } from "@/lib/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user, organisation, role } = await requireSession();

  // De enige plek op deze pagina die weet waar de data vandaan komt. Vervang
  // de store door een databank-implementatie en alles hieronder blijft gelijk.
  //
  // Het abonnement komt bewust níet uit die store maar uit de facturatie zelf:
  // dat is waar het opgezegd, gewisseld en betaald wordt, en een dashboard dat
  // daar een eigen versie van toont, is een dashboard dat je niet gelooft.
  const [overview, subscription] = await Promise.all([
    getDashboardStore().getOverview(organisation.id),
    loadSubscription(organisation.id),
  ]);

  const mayCreate = can(role, "project:create");
  const mayManageBilling = can(role, "billing:manage");
  const isNew = isNewOrganisation(overview);

  const billingNeedsAction = subscriptionNeedsAction(subscription.status);
  const failedCount = overview.projectCounts.mislukt;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overzicht van de video's, het verbruik en het abonnement van ${organisation.name}.`}
        actions={
          mayCreate ? (
            <Link
              href={ROUTES.newProject}
              className={buttonClasses("primary", "md", "w-full sm:w-auto")}
            >
              <Plus />
              Nieuwe video maken
            </Link>
          ) : null
        }
      />

      {/* Hoogstens één melding, anders wordt het scherm onrustig. */}
      {billingNeedsAction ? (
        <Alert variant="danger" title="Je abonnement vraagt aandacht" className="mb-6">
          Zolang de betaling openstaat, kunnen er geen nieuwe video&apos;s gerenderd worden.{" "}
          <Link href={ROUTES.billing} className="font-medium underline underline-offset-2">
            Naar facturatie
          </Link>
        </Alert>
      ) : failedCount > 0 ? (
        <Alert variant="warning" title="Een render is niet gelukt" className="mb-6">
          {failedCount === 1
            ? "Eén project is mislukt. Open het project om te zien wat er misging."
            : `${failedCount} projecten zijn mislukt. Open ze om te zien wat er misging.`}{" "}
          <Link
            href={`${ROUTES.projects}?status=mislukt`}
            className="font-medium underline underline-offset-2"
          >
            Bekijken
          </Link>
        </Alert>
      ) : null}

      {isNew ? null : (
        <StatusOverview
          counts={overview.projectCounts}
          total={overview.totalProjects}
          className="mb-4"
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isNew ? (
            <WelcomeCard firstName={user.name.split(" ")[0] ?? user.name} mayCreate={mayCreate} />
          ) : (
            <RecentProjectsCard projects={overview.recentProjects} mayCreate={mayCreate} />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <UsageCard usage={overview.usage} />
          <SubscriptionCard subscription={subscription} mayManage={mayManageBilling} />
          <QuickLinksCard className="sm:col-span-2 lg:col-span-1" />
        </div>
      </div>
    </>
  );
}
