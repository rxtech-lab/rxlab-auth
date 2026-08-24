import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  oauthClients,
  oauthClientEmailWhitelist,
  oauthClientAppIds,
  oauthClientRoles,
} from "@/lib/db/schema";
import { ClientDetailTabs } from "@/components/admin/client-detail-tabs";
import { getClientSignedInUsers } from "@/lib/admin/sign-in-history";
import { getOpenIDConfiguration } from "@/lib/oauth/discovery";
import { eq } from "drizzle-orm";

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function EditClientPage({ params }: PageProps) {
  const { id } = await params;

  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, id),
  });

  if (!client) {
    notFound();
  }

  const whitelistEmails = await db.query.oauthClientEmailWhitelist.findMany({
    where: eq(oauthClientEmailWhitelist.clientId, id),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  const appIds = await db.query.oauthClientAppIds.findMany({
    where: eq(oauthClientAppIds.clientId, id),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  const roles = await db.query.oauthClientRoles.findMany({
    where: eq(oauthClientRoles.clientId, id),
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  const signedInUsers = await getClientSignedInUsers(id);

  const config = getOpenIDConfiguration();
  const endpoints = {
    issuer: config.issuer,
    authorizationEndpoint: config.authorization_endpoint,
    tokenEndpoint: config.token_endpoint,
    discoveryUrl: `${config.issuer}/.well-known/openid-configuration`,
  };

  return (
    <ClientDetailTabs
      client={client}
      whitelistEmails={whitelistEmails}
      appIds={appIds}
      roles={roles}
      defaultRoleId={client.defaultRoleId}
      signedInUsers={signedInUsers}
      endpoints={endpoints}
    />
  );
}
