import { Key, User, Mail, Shield, Eye, Pencil } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Operation = "read" | "write";

export interface ScopeResource {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  operations: Operation[];
}

export interface SpecialScope {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  required?: boolean;
}

export interface Scope {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  required?: boolean;
  resource?: string;
  operation?: Operation;
}

// Resources that support read/write operations
export const SCOPE_RESOURCES: ScopeResource[] = [
  {
    key: "profile",
    title: "Profile",
    subtitle: "Your name and profile picture",
    icon: User,
    operations: ["read", "write"],
  },
  {
    key: "email",
    title: "Email",
    subtitle: "Your email address",
    icon: Mail,
    operations: ["read"],
  },
];

// Special scopes that don't follow the resource:operation pattern
export const SPECIAL_SCOPES: SpecialScope[] = [
  {
    key: "openid",
    title: "Authentication",
    subtitle: "Authenticate your identity",
    icon: Key,
    required: true,
  },
];

// Operation metadata for UI
export const OPERATIONS: Record<Operation, { title: string; icon: LucideIcon; verb: string }> = {
  read: { title: "Read", icon: Eye, verb: "View" },
  write: { title: "Write", icon: Pencil, verb: "Modify" },
};

// Generate all scopes from resources and special scopes
function generateScopes(): Scope[] {
  const scopes: Scope[] = [];

  // Add special scopes first
  for (const special of SPECIAL_SCOPES) {
    scopes.push({
      key: special.key,
      title: special.title,
      subtitle: special.subtitle,
      icon: special.icon,
      required: special.required,
    });
  }

  // Generate resource scopes (e.g., read:profile, write:profile)
  for (const resource of SCOPE_RESOURCES) {
    for (const operation of resource.operations) {
      const op = OPERATIONS[operation];
      scopes.push({
        key: `${operation}:${resource.key}`,
        title: `${op.title} ${resource.title}`,
        subtitle: `${op.verb} ${resource.subtitle.toLowerCase()}`,
        icon: resource.icon,
        resource: resource.key,
        operation,
      });
    }
  }

  return scopes;
}

export const SCOPES: Scope[] = generateScopes();

export const SUPPORTED_SCOPES = SCOPES.map((s) => s.key) as [string, ...string[]];
export type SupportedScope = (typeof SUPPORTED_SCOPES)[number];

export function getScope(key: string): Scope | undefined {
  return SCOPES.find((s) => s.key === key);
}

export function getScopesByResource(resourceKey: string): Scope[] {
  return SCOPES.filter((s) => s.resource === resourceKey);
}

export function getSpecialScopes(): Scope[] {
  return SCOPES.filter((s) => !s.resource);
}

export function getResourceScopes(): Scope[] {
  return SCOPES.filter((s) => !!s.resource);
}
