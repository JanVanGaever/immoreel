import type { Role } from "@/types";

/**
 * Rollen binnen een organisatie. Eén plek voor rangorde, labels en rechten,
 * zodat de UI en de serveracties dezelfde regels gebruiken.
 */

export const ROLES: readonly Role[] = ["owner", "editor", "viewer"];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Eigenaar",
  editor: "Editor",
  viewer: "Kijker",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Beheert de organisatie, facturatie en teamleden.",
  editor: "Maakt en bewerkt projecten en media.",
  viewer: "Bekijkt projecten en afgewerkte video's.",
};

/** Hoger getal = meer rechten. */
const ROLE_RANK: Record<Role, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

export function hasAtLeastRole(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Wat je binnen de app mag doen. Nieuwe rechten voeg je hier toe. */
export type Permission =
  | "organisation:manage"
  | "billing:manage"
  | "members:manage"
  | "project:create"
  | "project:edit"
  | "project:delete"
  | "media:upload"
  | "project:view";

const PERMISSIONS: Record<Permission, Role> = {
  "organisation:manage": "owner",
  "billing:manage": "owner",
  "members:manage": "owner",
  "project:create": "editor",
  "project:edit": "editor",
  "project:delete": "editor",
  "media:upload": "editor",
  "project:view": "viewer",
};

export function can(role: Role, permission: Permission): boolean {
  return hasAtLeastRole(role, PERMISSIONS[permission]);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
