import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RoleBadge } from "@/components/team/role-badge";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/lib/auth/config";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { describeInvitation } from "@/lib/team/lookup";
import { firstSearchParam } from "@/lib/utils";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Uitnodiging" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * De uitnodiging van een collega aanvaarden.
 *
 * Anders dan bij de herstellink wordt het token hier wél opgezocht vóór er
 * iets ingevuld is: zonder de naam van het kantoor en de rol is dit scherm
 * betekenisloos ("maak een account aan, waarvoor?"). Dat verraadt dat een
 * token bestaat, en dat is hier geen probleem — het token zegt niets over een
 * bestaand account, alleen dat iemand een collega uitnodigde.
 *
 * Wat er niet staat, is het e-mailadres van de uitgenodigde of iets over de
 * andere leden: een uitnodigingslink kan doorgestuurd zijn.
 */
export default async function InvitePage({ searchParams }: { searchParams: SearchParams }) {
  const token = firstSearchParam((await searchParams).token);
  const invitation = await describeInvitation(token);

  if (invitation.status === "onbruikbaar") {
    return (
      <AuthCard
        title="Deze uitnodiging werkt niet meer"
        description="Ze is verlopen, ingetrokken of al gebruikt."
      >
        <div className="flex flex-col gap-4">
          <Alert variant="warning" title="Vraag je collega om een nieuwe uitnodiging.">
            Een uitnodiging blijft zeven dagen geldig en werkt één keer. Heb je hier al een
            account, log dan gewoon in.
          </Alert>
          <Link href={AUTH_ROUTES.login} className={buttonClasses("primary", "md")}>
            Naar inloggen
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (invitation.status === "bestaat-al") {
    return (
      <AuthCard
        title={`Uitnodiging voor ${invitation.organisationName}`}
        description="Dit e-mailadres hoort al bij een account op Immoreel."
      >
        <div className="flex flex-col gap-4">
          <Alert variant="info" title="Eén kantoor per account.">
            Een account kan voorlopig maar bij één kantoor horen. Log in met je bestaande
            account, of laat je collega je uitnodigen op een ander e-mailadres.
          </Alert>
          <Link href={AUTH_ROUTES.login} className={buttonClasses("primary", "md")}>
            Inloggen
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Welkom bij ${invitation.organisationName}`}
      description={
        invitation.invitedByName
          ? `${invitation.invitedByName} nodigde je uit. Nog twee velden en je bent binnen.`
          : "Je bent uitgenodigd. Nog twee velden en je bent binnen."
      }
      footer={
        <>
          Heb je al een account?{" "}
          <Link
            href={AUTH_ROUTES.login}
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            Inloggen
          </Link>
        </>
      }
    >
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-border bg-surface-subtle px-3.5 py-3">
        <RoleBadge role={invitation.role} className="mt-0.5" />
        <p className="text-sm text-fg-muted">
          Je komt binnen als {ROLE_LABELS[invitation.role].toLowerCase()}:{" "}
          {ROLE_DESCRIPTIONS[invitation.role].toLowerCase()}
        </p>
      </div>

      <InviteForm token={token ?? ""} />
    </AuthCard>
  );
}
