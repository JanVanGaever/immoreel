"use client";

import Link from "next/link";
import { ExternalLink, RotateCcw } from "lucide-react";
import { BrandOverride } from "@/components/brand/brand-override";
import { EndCardPreview } from "@/components/brand/end-card-preview";
import type { EditorController } from "@/components/editor/use-editor";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BRAND_FONTS, findFont } from "@/lib/brand/fonts";
import { overriddenFields, resolveBrand } from "@/lib/brand/kit";
import { normaliseHex } from "@/lib/brand/colors";
import { LOGO_PLACEMENTS } from "@/lib/editor/branding";
import { ROUTES } from "@/lib/constants";
import type { BrandFontId, LogoPlacement } from "@/types";

/**
 * De huisstijl over deze video.
 *
 * Alles komt standaard van het kantoor: kleuren, teksten, lettertype,
 * contactgegevens. Dit paneel gaat over de uitzondering — dat ene pand waar de
 * makelaar zijn eigen nummer op wil, of die ene reel in de kleur van de
 * ontwikkelaar. Elk veld staat daarom op "volg huisstijl" tot je er zelf iets
 * van maakt, en zegt dat ook met zoveel woorden.
 *
 * Wat je hier verandert, geldt alleen voor dit project. Wie de huisstijl van
 * het kantoor zelf wil bijwerken, gaat naar de instellingen — de link staat
 * erbij, want dat is de vraag die na twee afwijkingen vanzelf komt.
 */
export function BrandingSelector({ editor }: { editor: EditorController }) {
  const { brand: kit, branding } = editor.document;
  const brand = resolveBrand(kit, branding);
  const overrides = overriddenFields(branding);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-fg">
              {kit.contact.agentName || "Huisstijl van je kantoor"}
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-fg-subtle">
              {overrides.length === 0
                ? "Dit project volgt de huisstijl volledig."
                : `${overrides.length} ${overrides.length === 1 ? "afwijking" : "afwijkingen"}: ${overrides.join(", ").toLowerCase()}.`}
            </p>
          </div>

          <Link
            href={ROUTES.brandKit}
            target="_blank"
            title="Huisstijl bewerken"
            className="shrink-0 rounded-sm p-1 text-fg-subtle hover:text-fg"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only">Huisstijl bewerken</span>
          </Link>
        </div>

        {overrides.length > 0 ? (
          <button
            type="button"
            onClick={editor.resetBrandOverrides}
            className="mt-2 inline-flex items-center gap-1 text-[0.6875rem] text-fg-subtle underline underline-offset-2 hover:text-fg"
          >
            <RotateCcw aria-hidden="true" className="size-3" />
            Alles terug naar de huisstijl
          </button>
        ) : null}
      </div>

      {/* De eindkaart van dít project, met de afwijkingen erin. Klein, maar
          groot genoeg om te zien of een eigen kleur nog werkt met de rest. */}
      <EndCardPreview brand={brand} aspectRatio={editor.document.aspectRatio} className="w-full" />

      <BrandOverride
        label="Primaire kleur"
        inherited={kit.primaryColor}
        isOverridden={branding.accentColor !== null}
        onOverride={() => editor.updateBranding({ accentColor: kit.primaryColor })}
        onInherit={() => editor.updateBranding({ accentColor: null })}
      >
        <ColorRow
          value={branding.accentColor ?? kit.primaryColor}
          onChange={(accentColor) => editor.updateBranding({ accentColor })}
        />
      </BrandOverride>

      <BrandOverride
        label="Secundaire kleur"
        inherited={kit.secondaryColor}
        isOverridden={branding.secondaryColor !== null}
        onOverride={() => editor.updateBranding({ secondaryColor: kit.secondaryColor })}
        onInherit={() => editor.updateBranding({ secondaryColor: null })}
      >
        <ColorRow
          value={branding.secondaryColor ?? kit.secondaryColor}
          onChange={(secondaryColor) => editor.updateBranding({ secondaryColor })}
        />
      </BrandOverride>

      <BrandOverride
        label="Lettertype"
        inherited={findFont(kit.fontId).label}
        isOverridden={branding.fontId !== null}
        onOverride={() => editor.updateBranding({ fontId: kit.fontId })}
        onInherit={() => editor.updateBranding({ fontId: null })}
      >
        <Select
          selectSize="sm"
          aria-label="Lettertype"
          value={branding.fontId ?? kit.fontId}
          onChange={(event) => editor.updateBranding({ fontId: event.target.value as BrandFontId })}
        >
          {BRAND_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </Select>
      </BrandOverride>

      <BrandOverride
        label="Outrotekst"
        inherited={kit.outroText || "Geen tekst"}
        isOverridden={branding.outroText !== null}
        onOverride={() => editor.updateBranding({ outroText: kit.outroText })}
        onInherit={() => editor.updateBranding({ outroText: null })}
      >
        <Input
          inputSize="sm"
          aria-label="Outrotekst"
          value={branding.outroText ?? ""}
          placeholder={kit.outroText}
          onChange={(event) => editor.updateBranding({ outroText: event.target.value })}
        />
      </BrandOverride>

      <BrandOverride
        label="Call to action"
        inherited={kit.ctaText || "Geen oproep"}
        isOverridden={branding.ctaText !== null}
        onOverride={() => editor.updateBranding({ ctaText: kit.ctaText })}
        onInherit={() => editor.updateBranding({ ctaText: null })}
      >
        <Input
          inputSize="sm"
          aria-label="Call to action"
          value={branding.ctaText ?? ""}
          placeholder={kit.ctaText}
          onChange={(event) => editor.updateBranding({ ctaText: event.target.value })}
        />
      </BrandOverride>

      <BrandOverride
        label="Contactgegevens"
        inherited={[kit.contact.agentName, kit.contact.phone].filter(Boolean).join(" · ") || "Leeg"}
        isOverridden={
          branding.agentName !== null || branding.agentPhone !== null || branding.agentEmail !== null
        }
        onOverride={() =>
          editor.updateBranding({
            agentName: kit.contact.agentName,
            agentPhone: kit.contact.phone,
            agentEmail: kit.contact.email,
          })
        }
        onInherit={() =>
          editor.updateBranding({ agentName: null, agentPhone: null, agentEmail: null })
        }
      >
        <div className="space-y-1.5">
          <Input
            inputSize="sm"
            aria-label="Naam van de makelaar"
            placeholder="Naam van de makelaar"
            value={branding.agentName ?? ""}
            onChange={(event) => editor.updateBranding({ agentName: event.target.value })}
          />
          <Input
            inputSize="sm"
            type="tel"
            aria-label="Telefoonnummer"
            placeholder="Telefoonnummer"
            value={branding.agentPhone ?? ""}
            onChange={(event) => editor.updateBranding({ agentPhone: event.target.value })}
          />
          <Input
            inputSize="sm"
            type="email"
            aria-label="E-mailadres"
            placeholder="E-mailadres"
            value={branding.agentEmail ?? ""}
            onChange={(event) => editor.updateBranding({ agentEmail: event.target.value })}
          />
        </div>
      </BrandOverride>

      <BrandOverride
        label="Watermerk"
        inherited={kit.watermarkByDefault ? "Aan" : "Uit"}
        isOverridden={branding.showWatermark !== null}
        onOverride={() => editor.updateBranding({ showWatermark: !kit.watermarkByDefault })}
        onInherit={() => editor.updateBranding({ showWatermark: null })}
      >
        <Switch
          checked={brand.showWatermark}
          onCheckedChange={(checked) => editor.updateBranding({ showWatermark: checked })}
          label={<span className="text-xs text-fg">Logo over elke scène</span>}
        />
      </BrandOverride>

      {/* Geen overrule maar een keuze per project: waar het watermerk staat,
          hangt van de foto's af en niet van het kantoor. */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-fg">Plaats van het watermerk</span>
        <Select
          selectSize="sm"
          aria-label="Plaats van het watermerk"
          disabled={!brand.showWatermark}
          value={branding.logoPlacement}
          onChange={(event) =>
            editor.updateBranding({ logoPlacement: event.target.value as LogoPlacement })
          }
        >
          {LOGO_PLACEMENTS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <Switch
          checked={branding.showContactCard}
          onCheckedChange={(checked) => editor.updateBranding({ showContactCard: checked })}
          label={<span className="text-xs text-fg">Eindkaart achteraan</span>}
          description={
            <span className="text-[0.6875rem] text-fg-subtle">
              Voegt de slotkaart met je contactgegevens toe.
            </span>
          }
        />
        <Switch
          checked={branding.showPriceBadge}
          onCheckedChange={(checked) => editor.updateBranding({ showPriceBadge: checked })}
          label={<span className="text-xs text-fg">Prijs over de eerste foto</span>}
        />
      </div>
    </div>
  );
}

/** Staal plus hexcode, in de maat van het rechterpaneel. */
function ColorRow({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={normaliseHex(value) ?? "#000000"}
        aria-label="Kleur kiezen"
        onChange={(event) => onChange(event.target.value)}
        className="size-7 shrink-0 cursor-pointer rounded-md border border-border bg-surface p-0.5"
      />
      <Input
        inputSize="sm"
        aria-label="Hexcode"
        value={value}
        spellCheck={false}
        className="font-mono"
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          const normalised = normaliseHex(value);
          if (normalised && normalised !== value) onChange(normalised);
        }}
      />
    </div>
  );
}
