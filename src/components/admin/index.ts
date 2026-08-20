// De bouwstenen van het interne paneel. Bewust apart van `@/components/ui`:
// niets hieronder hoort ooit in een klantenscherm terecht te komen.

export { AdminShell } from "@/components/admin/admin-shell";
export { CellStack, DataTable, Identifier } from "@/components/admin/data-table";
export { DetailList } from "@/components/admin/detail-list";
export { FilterBar } from "@/components/admin/filter-bar";
export { JobTable } from "@/components/admin/job-table";
export { LogList } from "@/components/admin/log-list";
export { Pagination } from "@/components/admin/pagination";
export { ProjectTable } from "@/components/admin/project-table";
export { RawRecord } from "@/components/admin/raw-record";
export { PlanBadge, SubscriptionBadge } from "@/components/admin/status";

export type { DataTableColumn } from "@/components/admin/data-table";
export type { DetailItem } from "@/components/admin/detail-list";
export type { FilterOption, FilterSelect } from "@/components/admin/filter-bar";
