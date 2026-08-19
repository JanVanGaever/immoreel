"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { Organisation, Role, User } from "@/types";

export type AppShellProps = {
  user: User;
  organisation: Organisation;
  role: Role;
  children: ReactNode;
};

/**
 * De shell van de applicatie: sidebar links, topbar bovenaan en een
 * gecentreerd contentgebied. Alle ingelogde pagina's zitten hierin.
 */
export function AppShell({ user, organisation, role, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-svh bg-canvas">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[var(--sidebar-width)]">
        <Topbar
          user={user}
          organisation={organisation}
          role={role}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[86rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
