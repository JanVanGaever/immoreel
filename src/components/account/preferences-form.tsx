"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChoiceGroup, Radio } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { initialAccountState, type AccountActionState } from "@/lib/account/action-state";
import { savePreferencesAction } from "@/lib/account/actions";
import { LOCALES, NOTIFICATION_ITEMS } from "@/lib/account/preferences";
import type { Locale, NotificationPreferences, UserPreferences } from "@/types";

export type PreferencesFormProps = { preferences: UserPreferences };

/**
 * Taal en meldingen, samen in één formulier met één knop.
 *
 * Ze staan bij elkaar omdat ze hetzelfde zijn: voorkeuren die niets kapot
 * maken. Daarom ook geen bevestiging en geen wachtwoord — dit is het tabblad
 * waar je gerust mag klikken.
 */
export function PreferencesForm({ preferences }: PreferencesFormProps) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(preferences.locale);
  const [notifications, setNotifications] = useState<NotificationPreferences>(
    preferences.notifications,
  );
  const [state, setState] = useState<AccountActionState>(initialAccountState);
  const [pending, startTransition] = useTransition();

  const changed =
    locale !== preferences.locale ||
    NOTIFICATION_ITEMS.some(
      (item) => notifications[item.id] !== preferences.notifications[item.id],
    );

  function save() {
    setState(initialAccountState);

    startTransition(async () => {
      const result = await savePreferencesAction({ locale, notifications });

      setState(result);
      if (result.status === "gelukt") router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {state.status !== "idle" && state.message ? (
        <Alert variant={state.status === "gelukt" ? "success" : "danger"} title={state.message} />
      ) : null}

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Taal</CardTitle>
            <CardDescription>
              De taal waarin we je aanspreken in e-mails en meldingen.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <ChoiceGroup className="gap-3">
            {LOCALES.map((option) => (
              <Radio
                key={option.id}
                name="locale"
                value={option.id}
                checked={locale === option.id}
                disabled={pending}
                onChange={() => setLocale(option.id)}
                label={option.label}
                description={option.description}
              />
            ))}
          </ChoiceGroup>

          {/* Eerlijk zijn over wat de keuze vandaag doet is beter dan een
              instelling die stilzwijgend niets verandert. */}
          <Alert variant="info" title="De schermen zelf blijven voorlopig Nederlands.">
            Immoreel is nog niet vertaald. Je keuze wordt bewaard en gaat mee zodra de
            vertalingen er zijn — de e-mails eerst.
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Meldingen</CardTitle>
            <CardDescription>Waarover we je een e-mail mogen sturen.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {NOTIFICATION_ITEMS.map((item) => (
            <Switch
              key={item.id}
              checked={notifications[item.id]}
              disabled={pending}
              onCheckedChange={(checked) =>
                setNotifications((current) => ({ ...current, [item.id]: checked }))
              }
              label={item.label}
              description={item.description}
            />
          ))}

          <Alert variant="info" title="Er wordt nog niets verstuurd.">
            Er hangt nog geen e-mailprovider aan Immoreel. Deze schakelaars leggen vast wat je
            wil ontvangen zodra dat wel zo is.
          </Alert>
        </CardContent>
      </Card>

      {/* Eén knop voor allebei de kaarten: taal en meldingen zijn samen één
          set voorkeuren, en twee opslagknoppen naast elkaar zou de vraag
          oproepen wat de andere dan bewaart. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          icon={<Check />}
          onClick={save}
          isLoading={pending}
          loadingLabel="Bezig met bewaren"
          disabled={!changed || pending}
        >
          Voorkeuren bewaren
        </Button>
        <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <Languages aria-hidden="true" className="size-3.5" />
          {changed ? "Nog niet bewaard" : "Alles staat bewaard"}
        </span>
      </div>
    </div>
  );
}
