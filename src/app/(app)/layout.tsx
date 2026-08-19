import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth/session";

/**
 * Layout voor alle ingelogde pagina's. De middleware houdt bezoekers zonder
 * cookie al tegen; `requireSession()` is het tweede slot en levert meteen de
 * gebruiker, zijn organisatie en zijn rol.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  return (
    <AppShell user={session.user} organisation={session.organisation} role={session.role}>
      {children}
    </AppShell>
  );
}
