// Componenten van het dashboard. Ze krijgen hun data als props, zodat de
// pagina de enige plek blijft die weet waar die data vandaan komt.

export { ProjectList, ProjectListItem } from "@/components/dashboard/project-list";
export { ProjectStatusBadge } from "@/components/dashboard/project-status-badge";
export { QuickLinksCard } from "@/components/dashboard/quick-links-card";
export { RecentProjectsCard } from "@/components/dashboard/recent-projects-card";
export { StatusOverview } from "@/components/dashboard/status-overview";
export { SubscriptionCard } from "@/components/dashboard/subscription-card";
export { UsageCard } from "@/components/dashboard/usage-card";
export { WelcomeCard } from "@/components/dashboard/welcome-card";

export type { ProjectListItemProps, ProjectListProps } from "@/components/dashboard/project-list";
export type { ProjectStatusBadgeProps } from "@/components/dashboard/project-status-badge";
export type { QuickLinksCardProps } from "@/components/dashboard/quick-links-card";
export type { RecentProjectsCardProps } from "@/components/dashboard/recent-projects-card";
export type { StatusOverviewProps } from "@/components/dashboard/status-overview";
export type { SubscriptionCardProps } from "@/components/dashboard/subscription-card";
export type { UsageCardProps } from "@/components/dashboard/usage-card";
export type { WelcomeCardProps } from "@/components/dashboard/welcome-card";
