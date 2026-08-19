import Link from "next/link";
import { ChevronRight, CreditCard, Palette, Users, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type QuickLink = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

/**
 * De drie plekken waar een kantoor na de eerste video het vaakst naartoe
 * moet. Bewust kort: de volledige navigatie staat in de sidebar.
 */
const quickLinks: QuickLink[] = [
  {
    label: "Huisstijl",
    description: "Logo, kleuren en lettertype voor je video's.",
    href: ROUTES.brandKit,
    icon: Palette,
  },
  {
    label: "Team",
    description: "Collega's uitnodigen en rollen toekennen.",
    href: ROUTES.team,
    icon: Users,
  },
  {
    label: "Facturatie",
    description: "Abonnement, verbruik en facturen.",
    href: ROUTES.billing,
    icon: CreditCard,
  },
];

export type QuickLinksCardProps = { className?: string };

export function QuickLinksCard({ className }: QuickLinksCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Snel naar</CardTitle>
          <CardDescription>Instellingen die je kantoor het vaakst nodig heeft.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="-mx-3 divide-y divide-border">
          {quickLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3",
                  "transition-colors duration-150 hover:bg-surface-subtle",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-fg-muted">
                  <link.icon aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{link.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-fg-subtle">
                    {link.description}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
