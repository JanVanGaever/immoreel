"use client";

import type { EditorController } from "@/components/editor/use-editor";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { findBrandKit, listBrandKits, LOGO_PLACEMENTS, resolveAccentColor } from "@/lib/editor/branding";
import type { LogoPlacement } from "@/types";

/**
 * De huisstijl over deze video.
 *
 * Elke keuze is meteen in de preview te zien — het logo verschijnt in de hoek,
 * de slotkaart komt achteraan de tijdlijn erbij. Daarom staat de kleur hier
 * ook als eigen keuze naast de kit: wie voor één pand wil afwijken, hoeft
 * daarvoor geen nieuwe huisstijl te maken.
 */
export function BrandingSelector({ editor }: { editor: EditorController }) {
  const { branding } = editor.document;
  const kit = findBrandKit(branding.brandKitId);
  const accent = resolveAccentColor(branding);

  return (
    <div className="space-y-3">
      <Select
        selectSize="sm"
        aria-label="Huisstijl"
        value={branding.brandKitId ?? ""}
        onChange={(event) => editor.updateBranding({ brandKitId: event.target.value || null })}
      >
        <option value="">Geen huisstijl</option>
        {listBrandKits().map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
      {kit ? <p className="-mt-1 text-[0.6875rem] text-fg-muted">{kit.description}</p> : null}

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-[0.6875rem] text-fg-muted">
          <input
            type="color"
            value={accent}
            aria-label="Accentkleur"
            onChange={(event) => editor.updateBranding({ accentColor: event.target.value })}
            className="size-7 cursor-pointer rounded-md border border-border bg-surface p-0.5"
          />
          Accentkleur
        </label>
        {branding.accentColor ? (
          <button
            type="button"
            onClick={() => editor.updateBranding({ accentColor: null })}
            className="text-[0.6875rem] text-fg-subtle underline underline-offset-2 hover:text-fg"
          >
            Terug naar de huisstijl
          </button>
        ) : null}
      </div>

      <Select
        selectSize="sm"
        aria-label="Plaats van het logo"
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

      <div className="space-y-2">
        <Switch
          checked={branding.showContactCard}
          onCheckedChange={(checked) => editor.updateBranding({ showContactCard: checked })}
          label={<span className="text-xs text-fg">Slotkaart met contactgegevens</span>}
          description={
            <span className="text-[0.6875rem] text-fg-subtle">
              Voegt een blok achteraan de tijdlijn toe.
            </span>
          }
        />
        <Switch
          checked={branding.showPriceBadge}
          onCheckedChange={(checked) => editor.updateBranding({ showPriceBadge: checked })}
          label={<span className="text-xs text-fg">Prijs over de eerste foto</span>}
        />
      </div>

      <div className="space-y-2">
        <Input
          inputSize="sm"
          placeholder="Naam van de makelaar"
          aria-label="Naam van de makelaar"
          value={branding.agentName ?? ""}
          onChange={(event) => editor.updateBranding({ agentName: event.target.value || null })}
        />
        <Input
          inputSize="sm"
          type="tel"
          placeholder="Telefoonnummer"
          aria-label="Telefoonnummer"
          value={branding.agentPhone ?? ""}
          onChange={(event) => editor.updateBranding({ agentPhone: event.target.value || null })}
        />
      </div>
    </div>
  );
}
