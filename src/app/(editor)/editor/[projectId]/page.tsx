import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, Film } from "lucide-react";
import { EditorShell } from "@/components/editor/editor-shell";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getBrandKitStore } from "@/db/brand-kit-store";
import { getProjectStore } from "@/db/project-store";
import { getTemplateStore } from "@/db/template-store";
import { requireSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { toEditorDocument } from "@/lib/editor/document";

export const metadata: Metadata = { title: "Editor" };

type PageProps = { params: Promise<{ projectId: string }> };

/**
 * De editor laadt het project op de server en geeft het als beginstand mee.
 * Daarna werkt alles in de browser; bewaren gaat via `saveProjectAction`.
 */
export default async function EditorPage({ params }: PageProps) {
  const { projectId } = await params;
  const { organisation } = await requireSession();

  const [project, templates, brand] = await Promise.all([
    getProjectStore().findProject(organisation.id, projectId),
    getTemplateStore().listTemplates(organisation.id),
    // De huisstijl van het kantoor ligt over elke preview heen; ze komt mee in
    // het document zodat de browser er niet voor terug hoeft naar de server.
    getBrandKitStore().getBrandKit(organisation.id),
  ]);

  if (!project) {
    // Bewust geen 404: de projectstore draait in het geheugen van het proces,
    // dus na een herstart van de server is een bestaand project weg. Dat
    // uitleggen helpt meer dan een lege foutpagina (zie `project-store.ts`).
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={Film}
          title="Dit project is er niet (meer)"
          description="Projecten worden voorlopig in het geheugen bewaard, dus na een herstart van de server zijn ze weg. Maak er een nieuw aan om verder te werken."
          action={
            <Link href={ROUTES.newProject} className={buttonClasses("primary", "md")}>
              <FilePlus2 />
              Nieuw project
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <EditorShell
      projectId={project.id}
      status={project.status}
      initialDocument={toEditorDocument(project, brand)}
      templates={templates}
    />
  );
}
