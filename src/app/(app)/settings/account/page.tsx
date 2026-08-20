import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AccountSettings } from "@/components/account/account-settings";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { getAccountStore } from "@/db/account-store";
import { getAuthStore } from "@/db/auth-store";
import { getBillingStore } from "@/db/billing-store";
import { getTeamStore } from "@/db/team-store";
import { checkAccountDeletion, organisationLeavesWithYou } from "@/lib/account/rules";
import { requireSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { countOwners } from "@/lib/team/rules";
import { firstSearchParam } from "@/lib/utils";
import type { PendingEmailChange } from "@/types";

export const metadata: Metadata = { title: "Mijn account" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Meldingen die de bevestigingsroute van het e-mailadres hier afzet. */
const NOTICES: Record<string, { variant: "success" | "warning"; text: string }> = {
  "e-mailadres-gewijzigd": {
    variant: "success",
    text: "Je nieuwe e-mailadres is bevestigd. Vanaf nu log je daarmee in.",
  },
  "e-mail-link-ongeldig": {
    variant: "warning",
    text: "Die bevestigingslink is verlopen of al gebruikt. Vraag hieronder een nieuwe aan.",
  },
  "e-mail-bezet": {
    variant: "warning",
    text: "Dat e-mailadres is intussen door iemand anders in gebruik genomen.",
  },
};

/**
 * Je eigen account: naam, e-mailadres, wachtwoord, taal, meldingen en de
 * knop om ermee te stoppen.
 *
 * Er hoort geen recht bij. Dit is de enige pagina in de app waar de rol niets
 * uitmaakt — een kijker beheert zijn account net zo goed als een eigenaar. Wat
 * de rol wél bepaalt, staat op de teampagina.
 *
 * De pagina haalt alles op wat de vensters nodig hebben om vooraf te kunnen
 * zeggen wat kan: of er een wachtwoord ingesteld is, of er een e-mailwijziging
 * openstaat, en of verwijderen mag.
 */
export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSession();
  const authStore = getAuthStore();

  const [record, preferences, emailToken, members, subscription] = await Promise.all([
    authStore.findUserById(session.user.id),
    getAccountStore().getPreferences(session.user.id),
    authStore.findOpenAuthToken(session.user.id, "email-change"),
    getTeamStore().listMembers(session.organisation.id),
    getBillingStore().getSubscription(session.organisation.id),
  ]);

  const noticeKey = firstSearchParam((await searchParams).melding);
  const notice = noticeKey ? NOTICES[noticeKey] : undefined;

  // Alleen het adres en de vervaldatum gaan naar de client; het token blijft
  // op de server, ook in gehashte vorm.
  const pendingEmail: PendingEmailChange | null =
    emailToken?.email ? { email: emailToken.email, expiresAt: emailToken.expiresAt } : null;

  const deletionContext = {
    role: session.role,
    otherMembers: members.filter((member) => member.membershipId !== session.membershipId).length,
    owners: countOwners(members),
    subscriptionStatus: subscription.status,
  };

  return (
    <>
      <PageHeader
        title="Mijn account"
        description="Je gegevens, je wachtwoord en hoe je Immoreel wil gebruiken."
        actions={
          <Link href={ROUTES.settings} className={buttonClasses("secondary", "md")}>
            <ArrowLeft />
            Instellingen
          </Link>
        }
      />

      {notice ? <Alert variant={notice.variant} title={notice.text} className="mb-6" /> : null}

      <AccountSettings
        user={session.user}
        preferences={preferences}
        pendingEmail={pendingEmail}
        hasPassword={Boolean(record?.passwordHash)}
        role={session.role}
        organisationName={session.organisation.name}
        organisationLeaves={organisationLeavesWithYou(deletionContext)}
        deletionCheck={checkAccountDeletion(deletionContext)}
      />
    </>
  );
}
