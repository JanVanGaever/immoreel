import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandKitForm } from "@/components/brand/brand-kit-form";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { getBrandKitStore } from "@/db/brand-kit-store";
import { ROLE_LABELS, can } from "@/lib/auth/roles";
import { requireSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = { title: "Huisstijl" };

/**
 * De huisstijl van het kantoor.
 *
 * Een eigen pagina en geen kaart tussen de andere instellingen: dit scherm
 * heeft een preview nodig die naast het formulier past, en dat werkt niet in
 * een raster van kaarten van elk een halve kolom.
 *
 * Iedereen mag hier kijken — een editor die video's maakt, heeft er belang bij
 * te weten wat de huisstijl zegt. Aanpassen is aan de eigenaar, net als de
 * rest van de organisatiegegevens.
 */
export default async function BrandKitPage() {
  const { organisation, role } = await requireSession();
  const canManage = can(role, "organisation:manage");

  const kit = await getBrandKitStore().getBrandKit(organisation.id);

  return (
    <>
      <PageHeader
        title="Huisstijl"
        description="Logo, kleuren, teksten en contactgegevens. Elk project van je kantoor begint hiermee."
        actions={
          <Link href={ROUTES.settings} className={buttonClasses("secondary", "md")}>
            <ArrowLeft />
            Instellingen
          </Link>
        }
      />

      {!canManage ? (
        <Alert variant="info" title={`Je rol is ${ROLE_LABELS[role]}.`} className="mb-6">
          Alleen een {ROLE_LABELS.owner.toLowerCase()} past de huisstijl aan. Je ziet hier wel wat
          er ingesteld staat, zodat je weet hoe je video&apos;s eruit komen te zien.
        </Alert>
      ) : null}

      <BrandKitForm kit={kit} canManage={canManage} />
    </>
  );
}
