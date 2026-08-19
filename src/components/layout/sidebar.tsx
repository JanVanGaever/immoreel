"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isActivePath, navigation, secondaryNavigation, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-surface text-fg font-medium shadow-soft"
          : "text-fg-muted hover:bg-surface/70 hover:text-fg",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-fg-subtle")} />
      <span className="truncate">{item.label}</span>
      {item.soon ? (
        <Badge variant="neutral" className="ml-auto">
          binnenkort
        </Badge>
      ) : null}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[var(--topbar-height)] items-center px-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navigation.map((section) => (
          <div key={section.id}>
            {section.label ? (
              <p className="px-3 pb-2 text-[0.6875rem] font-semibold tracking-wider text-fg-subtle uppercase">
                {section.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActivePath(pathname, item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-border px-3 py-4">
        {secondaryNavigation.map((item) => (
          <NavLink key={item.href} item={item} active={false} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Desktop: vast in beeld */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] border-r border-border bg-surface-subtle lg:block">
        <SidebarContent />
      </aside>

      {/* Mobiel: uitschuifbaar paneel */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          onClick={onClose}
          className={cn(
            "absolute inset-0 bg-fg/20 backdrop-blur-[2px] transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-[var(--sidebar-width)] border-r border-border bg-surface-subtle",
            "shadow-elevated transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Navigatie sluiten"
            className="absolute top-3 right-3"
          >
            <X />
          </Button>
          <SidebarContent onNavigate={onClose} />
        </aside>
      </div>
    </>
  );
}
