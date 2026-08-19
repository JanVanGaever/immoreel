import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Video } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DraftNotice } from "@/components/new-project";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { can } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Projecten" };

export default async function ProjectsPage() {
  const { role } = await requireSession();
  const mayCreate = can(role, "project:create");

  return (
    <>
      <PageHeader
        title="Projecten"
        description="Alle videoprojecten van je kantoor, van concept tot afgewerkte render."
        actions={
          mayCreate ? (
            <Link href={ROUTES.newProject} className={buttonClasses("primary", "md")}>
              <Plus />
              Nieuw project
            </Link>
          ) : null
        }
      />

      {/* Een concept dat in de wizard is blijven liggen; staat in de browser
          van de gebruiker, dus dit blijft leeg tot na de hydratie. */}
      {mayCreate ? <DraftNotice className="mb-4" /> : null}

      <Card>
        <CardContent className="pt-5">
          <EmptyState
            icon={Video}
            title="Nog geen projecten"
            description="Hier komt de projectenlijst met filters op status, pand en aspect ratio."
            action={
              mayCreate ? (
                <Link href={ROUTES.newProject} className={buttonClasses("secondary", "md")}>
                  <Plus />
                  Eerste project aanmaken
                </Link>
              ) : null
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
