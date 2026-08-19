import Link from "next/link";
import { Plus, Video } from "lucide-react";
import { ProjectList } from "@/components/dashboard/project-list";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ROUTES } from "@/lib/constants";
import type { ProjectSummary } from "@/types";

export type RecentProjectsCardProps = {
  projects: ProjectSummary[];
  /** Verbergt de knop "Nieuwe video" voor rollen die niets mogen aanmaken. */
  mayCreate?: boolean;
  className?: string;
};

/** De laatst bewerkte projecten, met een lege staat voor wie nog niets heeft. */
export function RecentProjectsCard({
  projects,
  mayCreate = true,
  className,
}: RecentProjectsCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Recente projecten</CardTitle>
          <CardDescription>De laatst bewerkte video&apos;s van je kantoor.</CardDescription>
        </div>
        {projects.length > 0 ? (
          <Link href={ROUTES.projects} className={buttonClasses("ghost", "sm")}>
            Alles bekijken
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {projects.length > 0 ? (
          <ProjectList projects={projects} />
        ) : (
          <EmptyState
            icon={Video}
            title="Nog geen projecten"
            description="Voeg foto's van een pand toe en Immoreel monteert er een video van."
            className="py-10"
            action={
              mayCreate ? (
                <Link href={ROUTES.newProject} className={buttonClasses("secondary", "sm")}>
                  <Plus />
                  Eerste video maken
                </Link>
              ) : null
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
