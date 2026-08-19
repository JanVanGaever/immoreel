import {
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Images,
  Settings,
  Video,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/lib/constants";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Toont een "binnenkort"-label in de sidebar zolang de module nog leeg is. */
  soon?: boolean;
};

export type NavSection = {
  id: string;
  label?: string;
  items: NavItem[];
};

/**
 * Eén bron van waarheid voor de navigatie. Nieuwe modules voeg je hier toe;
 * sidebar, mobiele navigatie en breadcrumbs lezen allemaal uit deze lijst.
 */
export const navigation: NavSection[] = [
  {
    id: "werk",
    label: "Werk",
    items: [
      { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
      { label: "Projecten", href: ROUTES.projects, icon: Video },
      { label: "Media", href: ROUTES.media, icon: Images },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { label: "Facturatie", href: ROUTES.billing, icon: CreditCard },
      { label: "Instellingen", href: ROUTES.settings, icon: Settings },
    ],
  },
];

export const secondaryNavigation: NavItem[] = [
  { label: "Help & support", href: "/settings#support", icon: LifeBuoy },
];

/** Actief als het pad exact matcht of een subpad is (/projects/123). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
