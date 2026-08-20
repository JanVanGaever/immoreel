import {
  Building2,
  CreditCard,
  LayoutDashboard,
  ScrollText,
  TriangleAlert,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { ID } from "@/types";

/**
 * De routes van het interne paneel, apart van `ROUTES` in
 * `src/lib/constants.ts`. Dat is geen netheid maar een grens: niets in de
 * klantenapp hoort naar `/admin` te linken, en met een eigen bestand is dat
 * ook aan de imports te zien.
 */
export const ADMIN_ROUTES = {
  overview: "/admin",
  users: "/admin/users",
  organisations: "/admin/organisations",
  organisation: (organisationId: ID) => `/admin/organisations/${organisationId}`,
  projects: "/admin/projects",
  project: (projectId: ID) => `/admin/projects/${projectId}`,
  jobs: "/admin/jobs",
  job: (jobId: ID) => `/admin/jobs/${encodeURIComponent(jobId)}`,
  billing: "/admin/billing",
  logs: "/admin/logs",
} as const;

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

/**
 * De navigatie van het paneel, in de volgorde waarin een supportvraag
 * doorgaans loopt: eerst wie belt, dan welk kantoor, dan welk project, dan wat
 * er misging.
 */
export const adminNavigation: AdminNavItem[] = [
  {
    label: "Overzicht",
    href: ADMIN_ROUTES.overview,
    icon: LayoutDashboard,
    description: "De stand van zaken en wat er vandaag misging.",
  },
  {
    label: "Gebruikers",
    href: ADMIN_ROUTES.users,
    icon: Users,
    description: "Zoek op naam, e-mailadres of id.",
  },
  {
    label: "Kantoren",
    href: ADMIN_ROUTES.organisations,
    icon: Building2,
    description: "Organisaties met hun leden, projecten en abonnement.",
  },
  {
    label: "Projecten",
    href: ADMIN_ROUTES.projects,
    icon: Video,
    description: "Alle videoprojecten, over alle kantoren heen.",
  },
  {
    label: "Renders",
    href: ADMIN_ROUTES.jobs,
    icon: TriangleAlert,
    description: "Renderjobs, standaard gefilterd op mislukt.",
  },
  {
    label: "Facturatie",
    href: ADMIN_ROUTES.billing,
    icon: CreditCard,
    description: "Abonnementen, mislukte incasso's en lopende afrekeningen.",
  },
  {
    label: "Logs",
    href: ADMIN_ROUTES.logs,
    icon: ScrollText,
    description: "Alles wat er gebeurde, nieuwste eerst.",
  },
];

/** Actief als het pad exact matcht; het overzicht wint niet van zijn subpagina's. */
export function isActiveAdminPath(pathname: string, href: string): boolean {
  if (href === ADMIN_ROUTES.overview) return pathname === href;

  return pathname === href || pathname.startsWith(`${href}/`);
}
