import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, can } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = { title: "Instellingen" };

export default async function SettingsPage() {
  const { user, organisation, role } = await requireSession();
  const mayManageOrganisation = can(role, "organisation:manage");

  return (
    <>
      <PageHeader
        title="Instellingen"
        description="Organisatie, huisstijl en voorkeuren. De formulieren zijn nog niet aangesloten."
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

        <Card id="huisstijl">
          <CardHeader>
            <div>
              <CardTitle>Huisstijl</CardTitle>
              <CardDescription>Logo, kleuren en lettertype voor je video&apos;s.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Accentkleur" disabled={!mayManageOrganisation}>
              <Input placeholder="#0f5f57" />
            </FormField>
            <FormField label="Lettertype" disabled={!mayManageOrganisation}>
              <Input placeholder="Inter" />
            </FormField>
          </CardContent>
          <CardFooter>
            <Button disabled>Opslaan</Button>
          </CardFooter>
        </Card>

        <Card id="team">
          <CardHeader>
            <div>
              <CardTitle>Rollen</CardTitle>
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
            <Button disabled>Collega uitnodigen</Button>
            <span className="text-xs text-fg-subtle">Uitnodigingen komen later</span>
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
