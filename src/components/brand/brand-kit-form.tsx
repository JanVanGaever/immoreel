"use client";

import type { FormEvent } from "react";
import { Save } from "lucide-react";
import { BrandDiscover } from "@/components/brand/brand-discover";
import { BrandPresets } from "@/components/brand/brand-presets";
import { BrandPreview } from "@/components/brand/brand-preview";
import { ColorField } from "@/components/brand/color-field";
import { FontField } from "@/components/brand/font-field";
import { LogoField } from "@/components/brand/logo-field";
import { useBrandKitForm } from "@/components/brand/use-brand-kit-form";
import { Alert } from "@/components/ui/alert";
import { ErrorSummary } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/field";
import { Form, FormActions, FormRow } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { UnsavedChangesGuard } from "@/components/ui/unsaved-changes-guard";
import { CTA_TEXT_MAX_LENGTH, OUTRO_TEXT_MAX_LENGTH } from "@/lib/brand/validation";
import { formatDateTime } from "@/lib/format";
import type { BrandKit } from "@/types";

/**
 * De huisstijl van het kantoor instellen.
 *
 * Links wat je invult, rechts wat het wordt. Die volgorde is de hele opzet van
 * dit scherm: er is geen "opslaan en dan kijken" — de eindkaart naast het
 * formulier verandert bij elke toetsaanslag mee, zodat je kleuren en teksten
 * beoordeelt op wat ze doen en niet op wat ze heten.
 *
 * Bewaren gaat wel pas op de knop. Dit is niet de editor: een huisstijl geldt
 * voor élk project van het kantoor, en dat verander je niet per ongeluk.
 */

export type BrandKitFormProps = {
  kit: BrandKit;
  /** Uit voor iedereen behalve de eigenaar; het scherm blijft wel leesbaar. */
  canManage: boolean;
};

export function BrandKitForm({ kit, canManage }: BrandKitFormProps) {
  const form = useBrandKitForm(kit);
  const { values, errors, warnings, state } = form;
  const disabled = !canManage || form.isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    form.save();
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Een huisstijl bewaar je met de knop, niet vanzelf zoals in de editor.
          Dan hoort wegklikken met openstaand werk een vraag te zijn — ook bij
          een klik op het menu, want daar merkt de browser zelf niets van. */}
      <UnsavedChangesGuard
        when={form.isDirty && !form.isPending}
        title="Je huisstijl is nog niet opgeslagen"
        description="De kleuren, teksten en gegevens die je zonet aanpaste, gaan verloren als je nu weggaat."
        discardLabel="Weggaan zonder opslaan"
      />

      <Form onSubmit={handleSubmit} noValidate className="gap-6">
        {/* Het formulier is langer dan het scherm: een fout op een veld dat
            hieronder ligt, is anders alleen te vinden door te scrollen. */}
        {state.status === "fout" ? (
          <ErrorSummary error={state.message} fields={state.fieldErrors} />
        ) : null}

        {state.status === "opgeslagen" ? (
          <Alert variant="success" title="Je huisstijl is opgeslagen.">
            Nieuwe video&apos;s gebruiken ze meteen. Projecten waarin je eerder van de huisstijl
            afweek, houden hun eigen keuzes.
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Logo en watermerk</CardTitle>
              <CardDescription>
                Komt op de eindkaart en, als het watermerk aanstaat, in de hoek van elke video.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <LogoField
              value={values.logoUrl}
              fileName={values.logoFileName}
              disabled={disabled}
              onChange={(logo) =>
                form.set({
                  logoUrl: logo?.url ?? null,
                  logoFileName: logo?.fileName ?? null,
                })
              }
            />

            <Switch
              checked={values.watermarkByDefault}
              disabled={disabled}
              onCheckedChange={(checked) => form.set({ watermarkByDefault: checked })}
              label="Watermerk standaard aan"
              description="Nieuwe projecten krijgen je logo over elke scène. Per project uit te zetten."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Kleuren en lettertype</CardTitle>
              <CardDescription>
                De primaire kleur draagt de kaarten; de secundaire is voor de call to action.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Boven de presets: wie zijn eigen website heeft, hoeft niet uit
                onze kleuren te kiezen. Wat hieruit komt is een voorstel dat het
                formulier invult — bewaren blijft een aparte klik. */}
            {canManage ? (
              <BrandDiscover
                onApply={(changes, contact) => {
                  form.set(changes);
                  form.setContact(contact);
                }}
              />
            ) : null}

            <BrandPresets onApply={form.applyPreset} disabled={disabled} />

            <FormRow>
              <ColorField
                label="Primaire kleur"
                hint="Achtergrond van de intro- en eindkaart."
                value={values.primaryColor}
                error={errors.primaryColor}
                disabled={disabled}
                onChange={(primaryColor) => form.set({ primaryColor })}
                onBlur={() => form.touch("primaryColor")}
              />
              <ColorField
                label="Secundaire kleur"
                hint="Het accent: de knop met je oproep."
                value={values.secondaryColor}
                error={errors.secondaryColor}
                disabled={disabled}
                onChange={(secondaryColor) => form.set({ secondaryColor })}
                onBlur={() => form.touch("secondaryColor")}
              />
            </FormRow>

            <FontField
              value={values.fontId}
              sample={values.contact.agentName}
              error={errors.fontId}
              disabled={disabled}
              onChange={(fontId) => form.set({ fontId })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Eindkaart</CardTitle>
              <CardDescription>
                De kaart achter elke video: één vraag, één oproep, en hoe ze je bereiken.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              label="Outrotekst"
              hint={`De zin boven je gegevens. Maximaal ${OUTRO_TEXT_MAX_LENGTH} tekens.`}
              error={errors.outroText}
              disabled={disabled}
            >
              <Input
                value={values.outroText}
                placeholder="Benieuwd naar dit pand?"
                onChange={(event) => form.set({ outroText: event.target.value })}
                onBlur={() => form.touch("outroText")}
              />
            </FormField>

            <FormField
              label="Call to action"
              hint={`Kort en in de gebiedende wijs werkt het best. Maximaal ${CTA_TEXT_MAX_LENGTH} tekens.`}
              error={errors.ctaText}
              disabled={disabled}
            >
              <Input
                value={values.ctaText}
                placeholder="Plan je bezoek"
                onChange={(event) => form.set({ ctaText: event.target.value })}
                onBlur={() => form.touch("ctaText")}
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Contactgegevens</CardTitle>
              <CardDescription>
                Wat er onderaan de eindkaart staat. Lege velden slaan we gewoon over.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              label="Naam op de kaart"
              hint="Je kantoornaam, of de naam van de makelaar zelf."
              error={errors.agentName}
              required
              disabled={disabled}
            >
              <Input
                value={values.contact.agentName}
                placeholder="Vastgoedkantoor Janssens"
                onChange={(event) => form.setContact({ agentName: event.target.value })}
                onBlur={() => form.touch("agentName")}
              />
            </FormField>

            <FormRow>
              <FormField label="Telefoon" error={errors.phone} disabled={disabled}>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={values.contact.phone}
                  placeholder="+32 3 234 56 78"
                  onChange={(event) => form.setContact({ phone: event.target.value })}
                  onBlur={() => form.touch("phone")}
                />
              </FormField>

              <FormField label="E-mailadres" error={errors.email} disabled={disabled}>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={values.contact.email}
                  placeholder="info@janssens.be"
                  onChange={(event) => form.setContact({ email: event.target.value })}
                  onBlur={() => form.touch("email")}
                />
              </FormField>
            </FormRow>

            <FormField label="Website" error={errors.website} disabled={disabled}>
              <Input
                inputMode="url"
                value={values.contact.website}
                placeholder="www.janssens.be"
                onChange={(event) => form.setContact({ website: event.target.value })}
                onBlur={() => form.touch("website")}
              />
            </FormField>
          </CardContent>
        </Card>

        {warnings.length > 0 && canManage ? (
          <Alert variant="warning" title="Nog even nakijken">
            <ul className="list-disc space-y-1 pl-4">
              {warnings.map((warning) => (
                <li key={warning.field}>{warning.message}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {canManage ? (
          // Blijft in beeld terwijl je scrollt: het formulier is lang genoeg
          // dat de knop anders onder de vouw verdwijnt zodra je aan het werk bent.
          <FormActions className="sticky bottom-0 bg-canvas/90 pb-1 backdrop-blur">
            <span className="mr-auto text-xs text-fg-subtle">
              {form.isDirty
                ? "Je hebt wijzigingen die nog niet bewaard zijn."
                : `Laatst bijgewerkt op ${formatDateTime(kit.updatedAt)}.`}
            </span>

            <Button variant="ghost" disabled={!form.isDirty || form.isPending} onClick={form.reset}>
              Wijzigingen ongedaan maken
            </Button>

            <Button
              type="submit"
              icon={<Save />}
              isLoading={form.isPending}
              loadingLabel="Bezig met opslaan"
              disabled={!form.isDirty}
            >
              Huisstijl opslaan
            </Button>
          </FormActions>
        ) : null}
      </Form>

      <BrandPreview brand={form.brand} className="xl:sticky xl:top-6" />
    </div>
  );
}
