"use client";

import { SlidersHorizontal, TriangleAlert, UserRound, ShieldCheck } from "lucide-react";
import { DeleteAccountCard } from "@/components/account/delete-account-card";
import { EmailCard } from "@/components/account/email-card";
import { PasswordForm } from "@/components/account/password-form";
import { PreferencesForm } from "@/components/account/preferences-form";
import { ProfileForm } from "@/components/account/profile-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate } from "@/lib/format";
import type { AccountCheck } from "@/lib/account/rules";
import type { PendingEmailChange, Role, User, UserPreferences } from "@/types";

export type AccountSettingsProps = {
  user: User;
  preferences: UserPreferences;
  pendingEmail: PendingEmailChange | null;
  hasPassword: boolean;
  role: Role;
  organisationName: string;
  organisationLeaves: boolean;
  deletionCheck: AccountCheck;
};

/**
 * De accountpagina in vier tabbladen.
 *
 * De volgorde is die van het risico: wat je dagelijks aanpast staat vooraan,
 * wat onomkeerbaar is achteraan. Verwijderen krijgt daarom een eigen tabblad
 * in plaats van een kaart onderaan het profiel — je komt er alleen als je
 * ernaar zoekt.
 */
export function AccountSettings({
  user,
  preferences,
  pendingEmail,
  hasPassword,
  role,
  organisationName,
  organisationLeaves,
  deletionCheck,
}: AccountSettingsProps) {
  return (
    <Tabs defaultValue="profiel">
      <TabsList>
        <TabsTrigger value="profiel">
          <UserRound />
          Profiel
        </TabsTrigger>
        <TabsTrigger value="beveiliging">
          <ShieldCheck />
          Beveiliging
        </TabsTrigger>
        <TabsTrigger value="voorkeuren">
          <SlidersHorizontal />
          Voorkeuren
        </TabsTrigger>
        <TabsTrigger value="account">
          <TriangleAlert />
          Account
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profiel" className="grid gap-4">
        <ProfileForm user={user} />
        <EmailCard user={user} pending={pendingEmail} hasPassword={hasPassword} />

        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Waar je bij hoort</CardTitle>
              <CardDescription>
                Je kantoor en je rol. Alleen een {ROLE_LABELS.owner.toLowerCase()} past die aan.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-medium text-fg">{organisationName}</span>
            <Badge variant="brand" size="sm">
              {ROLE_LABELS[role]}
            </Badge>
            <span className="text-xs text-fg-subtle">Lid sinds {formatDate(user.createdAt)}</span>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="beveiliging" className="grid gap-4">
        <PasswordForm hasPassword={hasPassword} />

        <Alert variant="info" title="Waar je nog op kan letten">
          Gebruik een wachtwoord dat je nergens anders gebruikt, en deel je account niet met een
          collega — daarvoor zijn er teamleden met een eigen rol.
        </Alert>
      </TabsContent>

      <TabsContent value="voorkeuren">
        <PreferencesForm preferences={preferences} />
      </TabsContent>

      <TabsContent value="account">
        <DeleteAccountCard
          email={user.email}
          organisationName={organisationName}
          organisationLeaves={organisationLeaves}
          check={deletionCheck}
          hasPassword={hasPassword}
        />
      </TabsContent>
    </Tabs>
  );
}
