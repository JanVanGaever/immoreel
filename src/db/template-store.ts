import type { ID, Template } from "@/types";

/**
 * De templatecatalogus achter één poort, net als `AuthStore` en
 * `DashboardStore`. Zolang er geen ORM gekozen is, staat hieronder een vaste
 * lijst; de wizard krijgt ze als props en merkt van de herkomst niets.
 *
 * Later komen hier ook de eigen templates van een kantoor bij: die hebben een
 * `organisationId`, de templates van Immoreel niet.
 */
export type TemplateStore = {
  /** De templates die dit kantoor mag gebruiken: die van Immoreel plus de eigen. */
  listTemplates(organisationId: ID): Promise<Template[]>;
  findTemplate(templateId: ID): Promise<Template | null>;
};

const CATALOGUE_CREATED_AT = "2026-01-06T09:00:00.000Z";

/**
 * De ids zijn stabiel: de presets in `src/lib/new-project/presets.ts`
 * verwijzen ernaar. Verdwijnt een template, dan valt `resolveTemplateId()`
 * terug op het eerste dat bij de beeldverhouding past.
 */
const catalogue: Template[] = [
  {
    id: "tpl_klassiek",
    organisationId: null,
    name: "Klassiek",
    description: "Rustige pans over elke foto, ruime titels. Werkt voor elk soort pand.",
    aspectRatios: ["16:9", "9:16", "1:1", "4:5"],
    previewUrl: null,
    createdAt: CATALOGUE_CREATED_AT,
    updatedAt: CATALOGUE_CREATED_AT,
  },
  {
    id: "tpl_dynamisch",
    organisationId: null,
    name: "Dynamisch",
    description: "Snelle overgangen op de maat van de muziek. Valt op in een feed.",
    aspectRatios: ["9:16", "1:1", "4:5"],
    previewUrl: null,
    createdAt: CATALOGUE_CREATED_AT,
    updatedAt: CATALOGUE_CREATED_AT,
  },
  {
    id: "tpl_zakelijk",
    organisationId: null,
    name: "Zakelijk",
    description: "Sober, met je logo in beeld en een contactblok op het einde.",
    aspectRatios: ["16:9", "1:1", "4:5"],
    previewUrl: null,
    createdAt: CATALOGUE_CREATED_AT,
    updatedAt: CATALOGUE_CREATED_AT,
  },
  {
    id: "tpl_snel",
    organisationId: null,
    name: "Snel & kort",
    description: "Korte scènes en een harde cut. Voor wie in 20 seconden klaar wil zijn.",
    aspectRatios: ["9:16", "1:1"],
    previewUrl: null,
    createdAt: CATALOGUE_CREATED_AT,
    updatedAt: CATALOGUE_CREATED_AT,
  },
  {
    id: "tpl_luxe",
    organisationId: null,
    name: "Luxe",
    description: "Trage bewegingen, donkere titelkaarten. Voor het duurdere segment.",
    aspectRatios: ["16:9", "9:16"],
    previewUrl: null,
    createdAt: CATALOGUE_CREATED_AT,
    updatedAt: CATALOGUE_CREATED_AT,
  },
];

const mockStore: TemplateStore = {
  async listTemplates() {
    // TODO: hier komen de eigen templates van de organisatie bij.
    return catalogue;
  },

  async findTemplate(templateId) {
    return catalogue.find((template) => template.id === templateId) ?? null;
  },
};

export function getTemplateStore(): TemplateStore {
  // TODO: databank-implementatie zodra de ORM gekozen is (zie `src/db/client.ts`).
  return mockStore;
}
