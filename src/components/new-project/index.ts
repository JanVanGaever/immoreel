// De "Nieuw project"-wizard. De pagina geeft alleen de templatecatalogus mee;
// al de rest gebeurt in de browser tot het project echt aangemaakt wordt.

export { DraftNotice } from "@/components/new-project/draft-notice";
export { NewProjectWizard } from "@/components/new-project/new-project-wizard";
export { OptionCard, OptionGrid } from "@/components/new-project/option-card";
export { useProjectDraft } from "@/components/new-project/use-project-draft";

export type { NewProjectWizardProps } from "@/components/new-project/new-project-wizard";
export type { OptionCardProps, OptionGridProps } from "@/components/new-project/option-card";
export type {
  AddPhotosResult,
  PhotoRejection,
  ProjectDraftController,
  RestorableDraft,
} from "@/components/new-project/use-project-draft";
