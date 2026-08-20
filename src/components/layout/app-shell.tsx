"use client";

import { useState, type ReactNode } from "react";
import { NotificationProvider } from "@/components/notifications";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ToastProvider } from "@/components/ui/toast";
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
 *
 * Hier hangen ook de twee providers voor meldingen, en in deze volgorde:
 * `ToastProvider` buitenop, want `NotificationProvider` toont er zelf toasts
 * mee. Ze staan op de shell en niet op de root-layout — een melding over een
 * afgewerkte render heeft een ingelogde gebruiker nodig, en het inlogscherm
 * hoeft er dus niet elke minuut naar te vragen.
 */
export function AppShell({ user, organisation, role, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <NotificationProvider>
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
      </NotificationProvider>
    </ToastProvider>
  );
}
