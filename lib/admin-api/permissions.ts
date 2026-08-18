export const READ_OAUTH_CLIENTS_PERMISSION = {
  key: "read:oauth_clients",
  title: "Read OAuth clients",
  description: "Search and list OAuth client metadata through admin APIs.",
} as const;

export const READ_USERS_PERMISSION = {
  key: "read:user:all",
  title: "Read users",
  description:
    "Search and list RxLab identities through the admin users API. Returns only ID, name, email, and profile image.",
} as const;

const READ_OAUTH_CLIENTS_PREFIX = `${READ_OAUTH_CLIENTS_PERMISSION.key}:`;

export type ReadOAuthClientsAccess =
  | { scope: "none"; clientIds: [] }
  | { scope: "all"; clientIds: [] }
  | { scope: "selected"; clientIds: string[] };

export interface ReadOAuthClientsPermissionSelection {
  enabled: boolean;
  scope: "all" | "selected";
  clientIds: string[];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function parseStoredAdminApiPermissions(
  storedPermissions: string | null | undefined,
): string[] {
  if (!storedPermissions) return [];

  try {
    const parsed: unknown = JSON.parse(storedPermissions);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function getReadOAuthClientsAccess(
  permissions: readonly string[],
): ReadOAuthClientsAccess {
  const clientIds: string[] = [];

  for (const permission of permissions) {
    if (!permission.startsWith(READ_OAUTH_CLIENTS_PREFIX)) continue;

    const resource = permission.slice(READ_OAUTH_CLIENTS_PREFIX.length);
    if (resource === "all") {
      return { scope: "all", clientIds: [] };
    }

    clientIds.push(
      ...resource
        .split(",")
        .map((clientId) => clientId.trim())
        .filter(Boolean),
    );
  }

  const scopedClientIds = unique(clientIds);
  return scopedClientIds.length > 0
    ? { scope: "selected", clientIds: scopedClientIds }
    : { scope: "none", clientIds: [] };
}

export function getReadOAuthClientsSelection(
  storedPermissions: string | null | undefined,
): ReadOAuthClientsPermissionSelection {
  const access = getReadOAuthClientsAccess(
    parseStoredAdminApiPermissions(storedPermissions),
  );

  if (access.scope === "selected") {
    return {
      enabled: true,
      scope: "selected",
      clientIds: access.clientIds,
    };
  }

  return {
    enabled: access.scope === "all",
    scope: "all",
    clientIds: [],
  };
}

export function buildReadOAuthClientsPermissions(
  selection: ReadOAuthClientsPermissionSelection,
): string[] {
  if (!selection.enabled) return [];
  if (selection.scope === "all") {
    return [`${READ_OAUTH_CLIENTS_PREFIX}all`];
  }

  const clientIds = unique(selection.clientIds.map((clientId) => clientId.trim()))
    .filter(Boolean)
    .sort();

  return clientIds.length > 0
    ? [`${READ_OAUTH_CLIENTS_PREFIX}${clientIds.join(",")}`]
    : [];
}

export function hasReadUsersPermission(
  permissions: readonly string[],
): boolean {
  return permissions.includes(READ_USERS_PERMISSION.key);
}

export function getReadUsersPermissionEnabled(
  storedPermissions: string | null | undefined,
): boolean {
  return hasReadUsersPermission(
    parseStoredAdminApiPermissions(storedPermissions),
  );
}

export function buildReadUsersPermissions(enabled: boolean): string[] {
  return enabled ? [READ_USERS_PERMISSION.key] : [];
}

export function isReadOAuthClientsPermission(value: string): boolean {
  if (value === `${READ_OAUTH_CLIENTS_PREFIX}all`) return true;
  if (!value.startsWith(READ_OAUTH_CLIENTS_PREFIX)) return false;

  const clientIds = value.slice(READ_OAUTH_CLIENTS_PREFIX.length).split(",");
  return (
    clientIds.length > 0 &&
    clientIds.every(
      (clientId) =>
        clientId.length > 0 &&
        !clientId.includes(":") &&
        !/\s/.test(clientId),
    )
  );
}

export function isSupportedAdminApiPermission(value: string): boolean {
  return (
    isReadOAuthClientsPermission(value) || value === READ_USERS_PERMISSION.key
  );
}
