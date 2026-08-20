import type { Metadata } from "next";
import Link from "next/link";
import { Palette, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
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
import { getBrandKitStore } from "@/db/brand-kit-store";
import { getTeamStore } from "@/db/team-store";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, can } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { findFont } from "@/lib/brand/fonts";
import { ROUTES, SUPPORT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = { title: "Instellingen" };

export default async function SettingsPage() {
  const { user, organisation, role } = await requireSession();
  const mayManageOrganisation = can(role, "organisation:manage");
  const mayManageMembers = can(role, "members:manage");

  const [brandKit, members] = await Promise.all([
    getBrandKitStore().getBrandKit(organisation.id),
    getTeamStore().listMembers(organisation.id),
  ]);
  const memberCount = members.length;

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Organisatie</CardTitle>
              <CardDescription>Gegevens van je kantoor.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Naam" disabled={!mayManageOrganisation}>
              <Input defaultValue={organisation.name} placeholder="Vastgoedkantoor Janssens" />
            </FormField>
            <FormField
              label="Btw-nummer"
              hint="Verschijnt op je facturen."
              disabled={!mayManageOrganisation}
            >
              <Input defaultValue={organisation.vatNumber ?? ""} placeholder="BE0123.456.789" />
            </FormField>
          </CardContent>
          <CardFooter>
            <Button disabled>Opslaan</Button>
            <span className="text-xs text-fg-subtle">Nog niet aangesloten</span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Jouw account</CardTitle>
              <CardDescription>Je persoonlijke gegevens en je rol.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Naam">
              <Input defaultValue={user.name} />
            </FormField>
            <FormField label="E-mailadres" hint="Hiermee log je in.">
              <Input defaultValue={user.email} type="email" disabled />
            </FormField>
          </CardContent>
          <CardFooter>
            <Button disabled>Opslaan</Button>
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
