import type {
  AuthToken,
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
  memberships: "memberships",
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
  memberships: Membership;
  properties: Property;
  media_assets: MediaAsset;
  templates: Template;
  video_projects: VideoProject;
  render_jobs: RenderJob;
  subscriptions: Subscription;
  invoices: Invoice;
};
