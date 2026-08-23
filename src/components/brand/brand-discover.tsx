"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { API_ROUTES } from "@/lib/constants";
import { findFont } from "@/lib/brand/fonts";
import type { BrandContact, BrandKitInput } from "@/types";

/**
 * De huisstijl ophalen uit de website van het kantoor.
 *
 * **Een voorstel en geen automaat**, en dat is de hele opzet van dit scherm.
 * Wat we vinden komt met de bron erbij en met een vinkje ervoor; pas wie
 * "Overnemen" duwt, verandert er iets in het formulier — en zelfs dan is er nog
 * niets bewaard. Een kleur die er in zeven van de tien gevallen goed uitziet, is
 * prachtig als suggestie en onbruikbaar als iets dat stilletjes gebeurt: de drie
 * andere kantoren zien hun video in de verkeerde kleur en weten niet waarom.
 *
 * Velden waar we minder zeker van zijn, staan standaard uit. Zo is de
 * makkelijkste klik ook de veiligste.
 */

type Signal<T> = { value: T; source: string; confidence: number };

type Suggestion = {
  url: string;
  primaryColor: Signal<string> | null;
  secondaryColor: Signal<string> | null;
  logoUrl: Signal<string> | null;
  logoAlternatieven?: string[];
  fontId: Signal<BrandKitInput["fontId"]> | null;
  agentName: Signal<string> | null;
  phone: Signal<string> | null;
  email: Signal<string> | null;
  notes: string[];
};

/** Sleutels die we uit een voorstel kunnen overnemen. */
type Veld =
  | "logoUrl"
  | "primaryColor"
  | "secondaryColor"
  | "fontId"
  | "agentName"
  | "phone"
  | "email";

const LABELS: Record<Veld, string> = {
  logoUrl: "Logo",
  primaryColor: "Hoofdkleur",
  secondaryColor: "Accentkleur",
  fontId: "Lettertype",
  agentName: "Naam van het kantoor",
  phone: "Telefoonnummer",
  email: "E-mailadres",
};

const BRONNEN: Record<string, string> = {
  "schema-org": "uit de bedrijfsgegevens voor Google",
  meta: "uit de metagegevens van de pagina",
  "css-variabele": "uit de stijlbladen",
  stylesheet: "uit de stijlbladen",
  link: "uit een link op de pagina",
  tekst: "uit de pagina zelf",
};

/** Onder deze grens staat het vinkje standaard uit. */
const ZEKER_GENOEG = 0.6;

export type BrandDiscoverProps = {
  onApply(changes: Partial<BrandKitInput>, contact: Partial<BrandContact>): void;
};

export function BrandDiscover({ onApply }: BrandDiscoverProps) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [gekozen, setGekozen] = useState<Set<Veld>>(new Set());
  const [logoBusy, setLogoBusy] = useState(false);

  async function discover() {
    setBusy(true);
    setError(null);
    setSuggestion(null);

    try {
      const response = await fetch(API_ROUTES.brandKitDiscover, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const body = (await response.json()) as Suggestion & { error?: { message: string } };

      if (!response.ok) {
        setError(body.error?.message ?? "We konden deze website niet bekijken.");
        return;
      }

      setSuggestion(body);
      // Alleen wat we met enige stelligheid gevonden hebben, staat aan.
      setGekozen(
        new Set(
          (Object.keys(LABELS) as Veld[]).filter(
            (veld) => (body[veld]?.confidence ?? 0) >= ZEKER_GENOEG,
          ),
        ),
      );
    } catch {
      setError("We konden deze website niet bekijken. Kijk het adres na.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!suggestion) return;

    const changes: Partial<BrandKitInput> = {};
    const contact: Partial<BrandContact> = {};

    // Het logo is het enige veld dat meer vraagt dan overschrijven: het staat op
    // de server van de klant en moet naar de onze, anders is het weg zodra hun
    // website verandert. Dat gebeurt hier en niet bij het ophalen — wie alleen
    // wil kijken, hoort geen bestand in onze opslag te zetten.
    if (gekozen.has("logoUrl") && suggestion.logoUrl) {
      setLogoBusy(true);

      try {
        const response = await fetch(API_ROUTES.brandKitLogoImport, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: suggestion.logoUrl.value,
            alternatives: suggestion.logoAlternatieven ?? [],
          }),
        });

        const body = (await response.json()) as {
          url?: string;
          fileName?: string;
          error?: { message: string };
        };

        if (response.ok && body.url) {
          changes.logoUrl = body.url;
          changes.logoFileName = body.fileName ?? "logo";
        } else {
          setError(body.error?.message ?? "We konden het logo niet overnemen.");
        }
      } catch {
        setError("We konden het logo niet overnemen. Upload het hieronder zelf.");
      } finally {
        setLogoBusy(false);
      }
    }

    if (gekozen.has("primaryColor") && suggestion.primaryColor) {
      changes.primaryColor = suggestion.primaryColor.value;
    }
    if (gekozen.has("secondaryColor") && suggestion.secondaryColor) {
      changes.secondaryColor = suggestion.secondaryColor.value;
    }
    if (gekozen.has("fontId") && suggestion.fontId) changes.fontId = suggestion.fontId.value;
    if (gekozen.has("agentName") && suggestion.agentName) {
      contact.agentName = suggestion.agentName.value;
    }
    if (gekozen.has("phone") && suggestion.phone) contact.phone = suggestion.phone.value;
    if (gekozen.has("email") && suggestion.email) contact.email = suggestion.email.value;

    // De website zelf is altijd waar we net gekeken hebben; die hoeft niemand
    // aan te vinken.
    contact.website = suggestion.url;

    onApply(changes, contact);
    setSuggestion(null);
  }

  function toon(veld: Veld): string | null {
    const found = suggestion?.[veld];
    if (!found) return null;

    return veld === "fontId" ? findFont(found.value as BrandKitInput["fontId"]).label : String(found.value);
  }

  const gevonden = suggestion
    ? (Object.keys(LABELS) as Veld[]).filter((veld) => suggestion[veld] !== null)
    : [];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-subtle p-4">
      <div>
        <h3 className="text-sm font-medium text-fg">Overnemen van je website</h3>
        <p className="mt-1 text-sm text-fg-muted">
          Vul het adres van je kantoorwebsite in. We kijken welke kleuren, gegevens en
          lettertypes we herkennen — je kiest daarna zelf wat je overneemt.
        </p>
      </div>

      <div className="flex items-end gap-2">
        <FormField label="Adres van je website" className="flex-1">
          <Input
            name="brandDiscoverUrl"
            type="url"
            inputMode="url"
            placeholder="kantoorjanssens.be"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </FormField>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void discover()}
          isLoading={busy}
          loadingLabel="Website bekijken"
          disabled={!url.trim()}
        >
          Ophalen
        </Button>
      </div>

      {error ? <Alert variant="warning" title={error} /> : null}

      {suggestion && gevonden.length === 0 ? (
        <Alert variant="info" title="We herkenden hier niets bruikbaars.">
          Op sommige sites staan de kleuren in een afbeelding of worden ze pas door JavaScript
          gezet, en daar kunnen we niet in kijken. Vul de huisstijl hieronder gewoon zelf in.
        </Alert>
      ) : null}

      {suggestion && gevonden.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg-muted">
            Gevonden op <span className="font-medium text-fg">{suggestion.url}</span>. Vink aan wat
            je wil overnemen:
          </p>

          <ul className="flex flex-col gap-2">
            {gevonden.map((veld) => {
              const found = suggestion[veld]!;
              const zeker = found.confidence >= ZEKER_GENOEG;

              return (
                <li key={veld} className="flex items-start gap-2">
                  <Checkbox
                    name={`overnemen-${veld}`}
                    checked={gekozen.has(veld)}
                    onChange={(event) =>
                      setGekozen((vorige) => {
                        const volgende = new Set(vorige);
                        if (event.target.checked) volgende.add(veld);
                        else volgende.delete(veld);

                        return volgende;
                      })
                    }
                    label={
                      <span className="flex flex-col">
                        <span className="text-sm text-fg">
                          {LABELS[veld]}
                          {veld === "logoUrl" ? "" : `: `}
                          {veld === "logoUrl" ? null : (
                            <span className="font-medium">{toon(veld)}</span>
                          )}
                          {veld === "primaryColor" || veld === "secondaryColor" ? (
                            <span
                              aria-hidden
                              className="ml-2 inline-block size-3 rounded-sm align-middle ring-1 ring-border"
                              style={{ backgroundColor: found.value as string }}
                            />
                          ) : null}
                        </span>

                        {/* Bij een logo zegt de bestandsnaam niets en het beeld
                            alles: een kantoor herkent zijn eigen logo in een
                            oogopslag, en ziet meteen of we de witte variant te
                            pakken hebben. Op een geruit vlak, want veel logo's
                            zijn wit met een doorzichtige achtergrond. */}
                        {veld === "logoUrl" ? (
                          <span className="mt-1 inline-flex w-fit rounded border border-border bg-[repeating-conic-gradient(theme(colors.gray.200)_0_25%,white_0_50%)] bg-[length:12px_12px] p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={found.value as string}
                              alt="Gevonden logo"
                              className="h-10 max-w-[10rem] object-contain"
                            />
                          </span>
                        ) : null}
                        <span className="text-xs text-fg-subtle">
                          {BRONNEN[found.source] ?? found.source}
                          {zeker ? "" : " — niet zeker, kijk dit na"}
                        </span>
                      </span>
                    }
                  />
                </li>
              );
            })}
          </ul>

          {suggestion.notes.map((note) => (
            <Alert key={note} variant="info" title={note} />
          ))}

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => void apply()}
              disabled={gekozen.size === 0}
              isLoading={logoBusy}
              loadingLabel="Logo ophalen"
            >
              Overnemen in het formulier
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSuggestion(null)}>
              Laat maar
            </Button>
          </div>

          <p className="text-xs text-fg-subtle">
            Overnemen vult alleen het formulier in. Bewaren doe je daarna zelf.
          </p>
        </div>
      ) : null}
    </div>
  );
}
