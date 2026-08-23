import type { Metadata } from "next";
import Link from "next/link";
import { Palette, UserRound, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getAccountStore } from "@/db/account-store";
import { getBrandKitStore } from "@/db/brand-kit-store";
import { getTeamStore } from "@/db/team-store";
import {
  NOTIFICATION_ITEMS,
  countEnabledNotifications,
  findLocale,
} from "@/lib/account/preferences";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, can } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { findFont } from "@/lib/brand/fonts";
import { ROUTES, SUPPORT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = { title: "Instellingen" };

export default async function SettingsPage() {
  const { user, organisation, role } = await requireSession();
  const mayManageOrganisation = can(role, "organisation:manage");
  const mayManageMembers = can(role, "members:manage");

  const [brandKit, members, preferences] = await Promise.all([
    getBrandKitStore().getBrandKit(organisation.id),
    getTeamStore().listMembers(organisation.id),
    getAccountStore().getPreferences(user.id),
  ]);
  const memberCount = members.length;
  const enabledNotifications = countEnabledNotifications(preferences.notifications);

  return (
    <>
      <PageHeader
        title="Instellingen"
        description="Organisatie, huisstijl en voorkeuren. Alleen de huisstijl is al aangesloten."
      />

      {!mayManageOrganisation ? (
        <Alert variant="info" title={`Je rol is ${ROLE_LABELS[role]}.`} className="mb-6">
          Alleen een {ROLE_LABELS.owner.toLowerCase()} kan de gegevens van de organisatie
          aanpassen.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Organisatie</CardTitle>
              <CardDescription>Gegevens van je kantoor.</CardDescription>
            </div>
          </CardHeader>
          {/* `readOnly` en niet gewoon een uitgeschakelde knop: zolang er geen
              serveractie achter zit, is een veld waarin je kan typen een
              belofte die we niet nakomen. Wie hier zijn btw-nummer aanpast en
              wegklikt, denkt dat het bewaard is. Lezen mag, typen nog niet. */}
          <CardContent className="space-y-4">
            <FormField label="Naam">
              <Input value={organisation.name} readOnly />
            </FormField>
            <FormField label="Btw-nummer" hint="Verschijnt op je facturen.">
              <Input value={organisation.vatNumber ?? "—"} readOnly />
            </FormField>
          </CardContent>
          <CardFooter>
            <span className="text-xs text-fg-subtle">
              Aanpassen kan nog niet — mail {SUPPORT_EMAIL} om deze gegevens te laten wijzigen.
            </span>
          </CardFooter>
        </Card>

        {/* Samenvatting, geen formulier: alles wat je aan je account kan
            veranderen — en wat er bevestiging bij nodig heeft — staat op een
            eigen pagina met tabbladen. */}
        <Card id="account">
          <CardHeader>
            <div>
              <CardTitle>Jouw account</CardTitle>
              <CardDescription>Je persoonlijke gegevens en je rol.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} src={user.avatarUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{user.name}</p>
                <p className="mt-0.5 truncate text-xs text-fg-subtle">{user.email}</p>
              </div>
              <Badge variant="brand" size="sm" className="ml-auto shrink-0">
                {ROLE_LABELS[role]}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral" size="sm">
                Taal: {findLocale(preferences.locale).label}
              </Badge>
              <Badge variant="neutral" size="sm">
                {enabledNotifications} van de {NOTIFICATION_ITEMS.length} meldingen aan
              </Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Link href={ROUTES.account} className={buttonClasses("secondary", "md")}>
              <UserRound />
              Account beheren
            </Link>
            <span className="text-xs text-fg-subtle">Naam, e-mailadres en wachtwoord</span>
          </CardFooter>
        </Card>

        {/* Samenvatting, geen formulier: de huisstijl heeft een preview nodig
            en staat daarom op een eigen pagina. */}
        <Card id="huisstijl">
          <CardHeader>
            <div>
              <CardTitle>Huisstijl</CardTitle>
              <CardDescription>
                Logo, kleuren, teksten en lettertype voor je video&apos;s.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border"
                style={{ backgroundColor: brandKit.primaryColor }}
              >
                <span
                  className="size-4 rounded-full"
                  style={{ backgroundColor: brandKit.secondaryColor }}
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">
                  {brandKit.contact.agentName || organisation.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-fg-subtle tabular-nums">
                  {brandKit.primaryColor} · {brandKit.secondaryColor} ·{" "}
                  {findFont(brandKit.fontId).label}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={brandKit.logoUrl ? "neutral" : "warning"} size="sm">
                {brandKit.logoUrl ? "Logo ingesteld" : "Nog geen logo"}
              </Badge>
              <Badge variant="neutral" size="sm">
                Watermerk standaard {brandKit.watermarkByDefault ? "aan" : "uit"}
              </Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Link href={ROUTES.brandKit} className={buttonClasses("secondary", "md")}>
              <Palette />
              Huisstijl bewerken
            </Link>
            <span className="text-xs text-fg-subtle">Met live preview van de eindkaart</span>
          </CardFooter>
        </Card>

        <Card id="team">
          <CardHeader>
            <div>
              <CardTitle>Team en rollen</CardTitle>
              <CardDescription>Wat elke rol binnen je kantoor mag.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROLES.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <Badge variant={item === role ? "brand" : "neutral"} size="sm" className="mt-0.5">
                  {ROLE_LABELS[item]}
                </Badge>
                <p className="text-sm text-fg-muted">
                  {ROLE_DESCRIPTIONS[item]}
                  {item === role ? <span className="text-fg-subtle"> — dit ben jij.</span> : null}
                </p>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Link href={ROUTES.team} className={buttonClasses("secondary", "md")}>
              <Users />
              Team beheren
            </Link>
            <span className="text-xs text-fg-subtle">
              {memberCount} {memberCount === 1 ? "collega" : "collega's"}
              {mayManageMembers ? " · uitnodigen en rollen aanpassen" : ""}
            </span>
          </CardFooter>
        </Card>

        <Card id="support" className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Help &amp; support</CardTitle>
              <CardDescription>
                Vragen of een bug gevonden? Mail naar {SUPPORT_EMAIL}.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
