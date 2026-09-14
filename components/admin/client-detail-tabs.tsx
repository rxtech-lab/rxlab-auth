import Link from "next/link";
import { Settings, Shield, AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClientForm } from "@/components/admin/client-form";
import { IconUpload } from "@/components/admin/icon-upload";
import { ClientSignInSettings } from "@/components/admin/client-sign-in-settings";
import { SignInMethodsCard } from "@/components/admin/sign-in-methods-card";
import { parseSignInMethods } from "@/lib/auth/sign-in-methods";
import type { SocialProviderId } from "@/lib/auth/social/providers";
import { ClientDangerZone } from "@/components/admin/client-danger-zone";
import { ClientAppIdsCard } from "@/components/admin/client-app-ids-card";
import { ClientRolesCard } from "@/components/admin/client-roles-card";
import { OAuthEndpointsCard } from "@/components/admin/oauth-endpoints-card";
import { SignedInUserList } from "@/components/admin/signed-in-user-list";
import type { SignedInUser } from "@/lib/admin/sign-in-history";
import type {
  OAuthClientRole,
  OAuthClientEmailWhitelist,
  OAuthClientAppId,
} from "@/lib/db/schema";

export const CLIENT_DETAIL_TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "users", label: "Users", icon: Users },
  { id: "permissions", label: "Permissions", icon: Shield },
  { id: "advanced", label: "Advanced", icon: AlertTriangle },
] as const;

export type ClientDetailTabId = (typeof CLIENT_DETAIL_TABS)[number]["id"];

export const DEFAULT_CLIENT_DETAIL_TAB: ClientDetailTabId = "general";

/**
 * Resolve a `?tab=` value. Anything unrecognised falls back to General rather
 * than rendering an empty page, since the URL is user-editable.
 */
export function parseClientDetailTab(
  value: string | undefined | null,
): ClientDetailTabId {
  return CLIENT_DETAIL_TABS.some((tab) => tab.id === value)
    ? (value as ClientDetailTabId)
    : DEFAULT_CLIENT_DETAIL_TAB;
}

interface ClientDetailTabsProps {
  activeTab: ClientDetailTabId;
  client: {
    id: string;
    name: string;
    description: string | null;
    redirectUris: string;
    allowedScopes: string;
    isFirstParty: boolean | null;
    iconUrl: string | null;
    signInPermission: string;
    signInMethods: string | null;
  };
  whitelistEmails: OAuthClientEmailWhitelist[];
  /** Social providers with server-wide credentials configured. */
  configuredSocialProviders: SocialProviderId[];
  appIds: OAuthClientAppId[];
  roles: OAuthClientRole[];
  defaultRoleId: string | null;
  signedInUsers: SignedInUser[];
  endpoints: {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    discoveryUrl: string;
  };
}

/**
 * Tabbed client detail view.
 *
 * The active tab comes from `?tab=` rather than component state, so a refresh,
 * a bookmark, or a link shared with a colleague all reopen the same tab. That
 * makes this a server component: the page reads the param, fetches only what
 * the chosen tab needs, and renders it — the tab strip is four links.
 */
export function ClientDetailTabs({
  activeTab,
  client,
  whitelistEmails,
  configuredSocialProviders,
  appIds,
  roles,
  defaultRoleId,
  signedInUsers,
  endpoints,
}: ClientDetailTabsProps) {
  const basePath = `/admin/dashboard/clients/${client.id}`;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-6 border-b border-border" data-testid="client-detail-tabs">
        {CLIENT_DETAIL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          // General is the default, so it gets the bare URL — no ?tab=general
          // clinging to the address bar for the page you land on.
          const href =
            tab.id === DEFAULT_CLIENT_DETAIL_TAB
              ? basePath
              : `${basePath}?tab=${tab.id}`;
          return (
            <Link
              key={tab.id}
              href={href}
              scroll={false}
              data-testid={`tab-${tab.id}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "general" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Icon</CardTitle>
              <CardDescription>
                Upload an icon for your application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IconUpload clientId={client.id} currentIconUrl={client.iconUrl} />
            </CardContent>
          </Card>

          <OAuthEndpointsCard endpoints={endpoints} />

          <Card>
            <CardHeader>
              <CardTitle>Edit {client.name}</CardTitle>
              <CardDescription>
                Update your OAuth client application settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 rounded-xl bg-muted">
                <p className="text-sm font-medium">Client ID</p>
                <p className="text-xs font-mono text-muted-foreground">{client.id}</p>
              </div>
              <ClientForm
                client={{
                  id: client.id,
                  name: client.name,
                  description: client.description,
                  redirectUris: JSON.parse(client.redirectUris),
                  allowedScopes: JSON.parse(client.allowedScopes),
                  isFirstParty: client.isFirstParty ?? false,
                }}
              />
            </CardContent>
          </Card>

          <ClientAppIdsCard clientId={client.id} initialAppIds={appIds} />
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="space-y-6">
          <ClientSignInSettings
            clientId={client.id}
            initialPermission={client.signInPermission as "all" | "none" | "whitelist"}
            initialEmails={whitelistEmails}
          />
          <SignInMethodsCard
            clientId={client.id}
            initialMethods={parseSignInMethods(client.signInMethods)}
            configuredProviders={configuredSocialProviders}
          />
          <ClientRolesCard
            clientId={client.id}
            initialRoles={roles}
            initialDefaultRoleId={defaultRoleId}
          />
        </div>
      )}

      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <CardTitle>Signed-in users</CardTitle>
            <CardDescription>
              {signedInUsers.length}{" "}
              {signedInUsers.length === 1 ? "user has" : "users have"} signed
              in to this application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignedInUserList users={signedInUsers} />
          </CardContent>
        </Card>
      )}

      {activeTab === "advanced" && (
        <ClientDangerZone clientId={client.id} clientName={client.name} />
      )}
    </div>
  );
}
