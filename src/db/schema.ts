import type {
  AuthToken,
  BrandKit,
  CheckoutAttempt,
  Invitation,
  Invoice,
  MediaAsset,
  Membership,
  Organisation,
  Property,
  RenderJob,
  Subscription,
  Template,
  UserRecord,
  VideoProject,
} from "@/types";

/**
 * Tabelnamen en rijvormen op één plek. De migraties volgen deze namen, zodat
 * de types in `src/types` en het databaseschema niet uit elkaar lopen.
 */
export const tables = {
  users: "users",
  authTokens: "auth_tokens",
  organisations: "organisations",
  brandKits: "brand_kits",
  checkoutAttempts: "checkout_attempts",
  memberships: "memberships",
  invitations: "invitations",
  properties: "properties",
  mediaAssets: "media_assets",
  templates: "templates",
  videoProjects: "video_projects",
  renderJobs: "render_jobs",
  subscriptions: "subscriptions",
  invoices: "invoices",
} as const;

export type TableName = (typeof tables)[keyof typeof tables];

export type Rows = {
  users: UserRecord;
  auth_tokens: AuthToken;
  organisations: Organisation;
  brand_kits: BrandKit;
  checkout_attempts: CheckoutAttempt;
  memberships: Membership;
  invitations: Invitation;
  properties: Property;
  media_assets: MediaAsset;
  templates: Template;
  video_projects: VideoProject;
  render_jobs: RenderJob;
  subscriptions: Subscription;
  invoices: Invoice;
};
