"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { adminNavigation, isActiveAdminPath, ADMIN_ROUTES } from "@/lib/admin/routes";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type AdminShellProps = {
  /** Wie er kijkt. Staat in beeld omdat een intern paneel nooit anoniem hoort te voelen. */
  email: string;
  children: ReactNode;
};

/**
 * De shell van het interne paneel.
 *
 * Bewust anders dan `AppShell`: een donkere balk, geen sidebar, en het woord
 * "Intern" naast het logo. Dat is geen versiering. Wie de hele dag tussen het
 * klantscherm en dit paneel springt, moet aan één blik genoeg hebben om te
 * weten waar hij zit — een adminpaneel dat eruitziet als de app is een
 * screenshot in een klantenmail die er niet in hoort.
 */
export function AdminShell({ email, children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-svh bg-canvas">
      <header className="border-b border-border bg-fg text-fg-inverted">
        <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link href={ADMIN_ROUTES.overview} className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-5" />
              <span className="tracking-tight">Immoreel support</span>
            </Link>
            <span className="rounded-full border border-current/30 px-2 py-0.5 text-[0.6875rem] font-medium tracking-wider uppercase opacity-80">
              Intern
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs opacity-80">
            <span className="truncate" title={email}>
              {email}
            </span>
            <Link
              href={ROUTES.dashboard}
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              Naar de app
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <nav className="mx-auto w-full max-w-[92rem] overflow-x-auto px-4 sm:px-6">
          <ul className="flex min-w-max items-center gap-1 pb-1">
            {adminNavigation.map((item) => {
              const active = isActiveAdminPath(pathname, item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={item.description}
                    className={cn(
                      "flex items-center gap-2 rounded-t-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-canvas font-medium text-fg"
                        : "text-fg-inverted/70 hover:bg-white/10 hover:text-fg-inverted",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:py-8">
        <div className="mx-auto w-full max-w-[92rem]">{children}</div>
      </main>
    </div>
  );
}
