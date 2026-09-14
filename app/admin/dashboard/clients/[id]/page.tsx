import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  oauthClients,
  oauthClientEmailWhitelist,
  oauthClientAppIds,
  oauthClientRoles,
} from "@/lib/db/schema";
import {
  ClientDetailTabs,
  parseClientDetailTab,
} from "@/components/admin/client-detail-tabs";
import { getClientSignedInUsers } from "@/lib/admin/sign-in-history";
import { getOpenIDConfiguration } from "@/lib/oauth/discovery";
import { eq } from "drizzle-orm";
import { getEnabledSocialProviders } from "@/lib/auth/social/providers";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, id),
  });

  if (!client) {
    return { title: "Client Not Found" };
  }

  return {
    title: `${client.name} - Admin`,
    description: `Manage OAuth client ${client.name}`,
  };
}

export default async function EditClientPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const activeTab = parseClientDetailTab((await searchParams).tab);

  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, id),
  });

  if (!client) {
    notFound();
  }

  // Now that the tab lives in the URL the page knows which one is rendering,
  // so it can fetch only that tab's data instead of all four tabs' worth on
  // every visit. The Advanced tab needs nothing beyond the client itself.
  const [appIds, whitelistEmails, roles, signedInUsers] = await Promise.all([
    activeTab === "general"
      ? db.query.oauthClientAppIds.findMany({
          where: eq(oauthClientAppIds.clientId, id),
          orderBy: (table, { desc }) => [desc(table.createdAt)],
        })
      : [],
    activeTab === "permissions"
      ? db.query.oauthClientEmailWhitelist.findMany({
          where: eq(oauthClientEmailWhitelist.clientId, id),
          orderBy: (table, { desc }) => [desc(table.createdAt)],
        })
      : [],
    activeTab === "permissions"
      ? db.query.oauthClientRoles.findMany({
          where: eq(oauthClientRoles.clientId, id),
          orderBy: (table, { asc }) => [asc(table.name)],
        })
      : [],
    activeTab === "users" ? getClientSignedInUsers(id) : [],
  ]);

  const config = getOpenIDConfiguration();
  const endpoints = {
    issuer: config.issuer,
    authorizationEndpoint: config.authorization_endpoint,
    tokenEndpoint: config.token_endpoint,
    discoveryUrl: `${config.issuer}/.well-known/openid-configuration`,
  };

  return (
    <ClientDetailTabs
      activeTab={activeTab}
      client={client}
      // Server-wide configured providers: a client can only narrow this list,
      // never add to it, so the card shows unconfigured ones as unavailable.
      configuredSocialProviders={getEnabledSocialProviders().map((p) => p.id)}
      whitelistEmails={whitelistEmails}
      appIds={appIds}
      roles={roles}
      defaultRoleId={client.defaultRoleId}
      signedInUsers={signedInUsers}
      endpoints={endpoints}
    />
  );
}
