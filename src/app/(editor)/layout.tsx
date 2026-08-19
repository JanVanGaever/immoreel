import type { ReactNode } from "react";
import { requirePermission } from "@/lib/auth/session";

/**
 * De editor krijgt bewust een eigen shell: volledige breedte, geen sidebar,
 * zodat de tijdlijn en preview alle ruimte hebben.
 *
 * Kijkers mogen hier niet komen: die zien het project wel, maar bewerken het
 * niet. Ze belanden terug op het dashboard.
 */
export default async function EditorLayout({ children }: { children: ReactNode }) {
  await requirePermission("project:edit");

  return <div className="flex h-svh flex-col overflow-hidden bg-canvas">{children}</div>;
}
