import type { Metadata } from "next";
import Link from "next/link";
import { Download, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Project" };

type PageProps = { params: Promise<{ projectId: string }> };

export default async function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = await params;

  return (
    <>
      <PageHeader
        title={`Project ${projectId}`}
        description="Detailpagina van het project: pandgegevens, media en renders."
        actions={
          <Link href={ROUTES.editor(projectId)} className={buttonClasses("primary", "md")}>
            <Pencil />
            Openen in editor
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Pand</CardTitle>
              <CardDescription>Adres, prijs en kenmerken die in de video komen.</CardDescription>
            </div>
            <Badge variant="neutral">concept</Badge>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">
            Nog niet gekoppeld aan de datalaag.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Renders</CardTitle>
              <CardDescription>Geschiedenis van deze video.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-fg-muted">
            <p>
              De voortgang van elke export en de afgewerkte bestanden staan op de downloadpagina.
            </p>
            <Link
              href={ROUTES.projectExports(projectId)}
              className={buttonClasses("secondary", "sm")}
            >
              <Download />
              Downloads bekijken
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
