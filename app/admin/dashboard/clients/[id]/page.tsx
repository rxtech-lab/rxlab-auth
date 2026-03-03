import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { oauthClients, oauthClientEmailWhitelist } from "@/lib/db/schema";
import { ClientDetailTabs } from "@/components/admin/client-detail-tabs";
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
      endpoints={endpoints}
    />
  );
}
