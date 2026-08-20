export { getDb, isDatabaseConfigured } from "@/db/client";
export { tables } from "@/db/schema";
export { DEFAULT_ROLE_ON_SIGNUP, getAuthStore, normaliseEmail } from "@/db/auth-store";
export { getBillingStore } from "@/db/billing-store";
export { getBrandKitStore } from "@/db/brand-kit-store";
export { RECENT_PROJECTS_LIMIT, getDashboardStore } from "@/db/dashboard-store";
export { getProjectStore } from "@/db/project-store";
export { getRenderJobStore } from "@/db/render-job-store";
export { getTeamStore } from "@/db/team-store";
export { getTemplateStore } from "@/db/template-store";

export type { DatabaseClient } from "@/db/client";
export type { Rows, TableName } from "@/db/schema";
export type {
  AuthStore,
  CreateAccountInput,
  CreateAccountResult,
  CreateAuthTokenInput,
  CreateMembershipInput,
  CreateUserInput,
} from "@/db/auth-store";
export type {
  BillingStore,
  CreateCheckoutInput,
  RecordInvoiceInput,
  SubscriptionPatch,
} from "@/db/billing-store";
export type { BrandKitStore } from "@/db/brand-kit-store";
export type { DashboardStore } from "@/db/dashboard-store";
export type { ProjectStore } from "@/db/project-store";
export type {
  ClaimResult,
  CreateRenderJobInput,
  RenderJobResult,
  RenderJobStore,
  RenderLease,
  RenderProgressUpdate,
} from "@/db/render-job-store";
export type {
  CreateInvitationInput,
  RefreshInvitationInput,
  TeamStore,
} from "@/db/team-store";
export type { TemplateStore } from "@/db/template-store";
