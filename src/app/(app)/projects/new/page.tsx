import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { NewProjectWizard } from "@/components/new-project";
import { buttonClasses } from "@/components/ui/button";
import { getTemplateStore } from "@/db/template-store";
import { requirePermission } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Nieuw project" };

/**
 * De enige plek in deze flow die weet waar de templates vandaan komen.
 * Kijkers horen hier niet: `requirePermission` stuurt ze terug naar het
 * dashboard.
 */
export default async function NewProjectPage() {
  const { organisation } = await requirePermission("project:create");
  const templates = await getTemplateStore().listTemplates(organisation.id);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Nieuw project"
        description="Van de foto's van een pand naar een video, in zes stappen."
        actions={
          <Link href={ROUTES.projects} className={buttonClasses("ghost", "md")}>
            <ArrowLeft />
            Naar projecten
          </Link>
        }
      />

      <NewProjectWizard templates={templates} />
    </div>
  );
}
