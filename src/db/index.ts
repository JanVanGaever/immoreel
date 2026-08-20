export { getDb, isDatabaseConfigured } from "@/db/client";
export { tables } from "@/db/schema";
export { DEFAULT_ROLE_ON_SIGNUP, getAuthStore, normaliseEmail } from "@/db/auth-store";
export { getAdminStore } from "@/db/admin-store";
export { getAccountStore } from "@/db/account-store";
export { getBillingStore } from "@/db/billing-store";
export { getBrandKitStore } from "@/db/brand-kit-store";
export { RECENT_PROJECTS_LIMIT, getDashboardStore } from "@/db/dashboard-store";
export { NOTIFICATION_LIMIT, getNotificationStore } from "@/db/notification-store";
export { getProjectStore } from "@/db/project-store";
export { getRenderJobStore } from "@/db/render-job-store";
export { getTeamStore } from "@/db/team-store";
export { getTemplateStore } from "@/db/template-store";
export {
  SEED_ORGANISATION_ID,
  SEED_PASSWORD,
  SEED_PROJECT_IDS,
  SEED_USER_IDS,
  isSeedEnabled,
} from "@/db/seed";

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
export type { AccountStore } from "@/db/account-store";
export type { AdminStore } from "@/db/admin-store";
export type {
  BillingStore,
  CreateCheckoutInput,
  RecordInvoiceInput,
  SubscriptionPatch,
} from "@/db/billing-store";
export type { BrandKitStore } from "@/db/brand-kit-store";
export type { DashboardStore } from "@/db/dashboard-store";
export type { CreateNotificationInput, NotificationStore } from "@/db/notification-store";
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
