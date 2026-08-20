import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin";
import { requireStaff } from "@/lib/admin/access";

export const metadata: Metadata = {
  title: { default: "Support", template: "%s · Support" },
  // Een intern paneel hoort nergens in een index te staan.
  robots: { index: false, follow: false },
};

/**
 * Alles onder `/admin` zit hierin.
 *
 * Drie sloten op dezelfde deur: `src/proxy.ts` weert iedereen zonder geldig
 * sessiecookie, `requireStaff()` weert iedereen die niet op `ADMIN_EMAILS`
 * staat, en de pagina's eronder lezen uitsluitend — er is geen serveractie die
 * vanuit dit paneel iets kan wijzigen.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaff();

  return <AdminShell email={session.user.email}>{children}</AdminShell>;
}
