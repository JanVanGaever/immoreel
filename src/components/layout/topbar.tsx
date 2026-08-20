"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Plus, Search, Settings, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationMenu } from "@/components/notifications";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { signOutAction } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { ROUTES } from "@/lib/constants";
import type { Organisation, Role, User } from "@/types";

export type TopbarProps = {
  user: User;
  organisation: Organisation;
  role: Role;
  onMenuClick: () => void;
};

export function Topbar({ user, organisation, role, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md sm:px-6">
      <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Navigatie openen" className="lg:hidden">
        <Menu />
      </Button>

      <div className="hidden w-full max-w-sm sm:block">
        <Input
          leadingIcon={<Search />}
          placeholder="Zoek een pand of project…"
          aria-label="Zoeken"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* De belangrijkste actie van de app hoort op elk scherm bereikbaar te
            zijn. Op een telefoon is er geen plaats voor het woord erbij, dus
            blijft alleen het plusje staan — met een naam voor wie hem niet
            ziet. */}
        <Link
          href={ROUTES.newProject}
          aria-label="Nieuwe video"
          className={buttonClasses("primary", "sm", "max-sm:size-[var(--control-sm)] max-sm:px-0")}
        >
          <Plus />
          <span className="hidden sm:inline">Nieuwe video</span>
        </Link>
        <ThemeToggle />
        <NotificationMenu />

        <div className="ml-1.5 border-l border-border pl-3">
          <DropdownMenu
            align="end"
            trigger={
              <button
                type="button"
                aria-label="Accountmenu"
                className="flex items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-surface-subtle"
              >
                <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                <span className="hidden leading-tight md:block">
                  <span className="block text-sm font-medium text-fg">{user.name}</span>
                  <span className="block text-xs text-fg-subtle">{organisation.name}</span>
                </span>
              </button>
            }
          >
            <div className="px-2.5 pt-2 pb-2.5">
              <p className="truncate text-sm font-medium text-fg">{user.name}</p>
              <p className="truncate text-xs text-fg-subtle">{user.email}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <Badge variant="brand" size="sm">
                  {ROLE_LABELS[role]}
                </Badge>
                <span className="truncate text-xs text-fg-subtle">{organisation.name}</span>
              </div>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuItem icon={<UserRound />} onSelect={() => router.push(ROUTES.account)}>
              Mijn account
            </DropdownMenuItem>

            <DropdownMenuItem icon={<Settings />} onSelect={() => router.push(ROUTES.settings)}>
              Instellingen
            </DropdownMenuItem>

            <DropdownMenuItem
              icon={<LogOut />}
              destructive
              disabled={signingOut}
              onSelect={() => startSignOut(() => signOutAction())}
            >
              {signingOut ? "Bezig met uitloggen…" : "Uitloggen"}
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
