"use client";

import { useState } from "react";
import { Settings, Shield, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClientForm } from "@/components/admin/client-form";
import { IconUpload } from "@/components/admin/icon-upload";
import { ClientSignInSettings } from "@/components/admin/client-sign-in-settings";
import { ClientDangerZone } from "@/components/admin/client-danger-zone";
import { OAuthEndpointsCard } from "@/components/admin/oauth-endpoints-card";
import type { OAuthClientEmailWhitelist } from "@/lib/db/schema";

interface ClientDetailTabsProps {
  client: {
    id: string;
    name: string;
    description: string | null;
    redirectUris: string;
    allowedScopes: string;
    isFirstParty: boolean | null;
    iconUrl: string | null;
    signInPermission: string;
  };
  whitelistEmails: OAuthClientEmailWhitelist[];
  endpoints: {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    discoveryUrl: string;
  };
}

const tabs = [
  { id: "general", label: "General", icon: Settings },
  { id: "permissions", label: "Permissions", icon: Shield },
  { id: "advanced", label: "Advanced", icon: AlertTriangle },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function ClientDetailTabs({ client, whitelistEmails, endpoints }: ClientDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-6 border-b border-border" data-testid="client-detail-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
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
            </button>
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
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="space-y-6">
          <ClientSignInSettings
            clientId={client.id}
            initialPermission={client.signInPermission as "all" | "none" | "whitelist"}
            initialEmails={whitelistEmails}
          />
        </div>
      )}

      {activeTab === "advanced" && (
        <ClientDangerZone clientId={client.id} clientName={client.name} />
      )}
    </div>
  );
}
