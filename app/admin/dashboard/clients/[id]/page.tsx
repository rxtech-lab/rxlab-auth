import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { oauthClients, oauthClientEmailWhitelist } from "@/lib/db/schema";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ClientForm } from "@/components/admin/client-form";
import { IconUpload } from "@/components/admin/icon-upload";
import { ClientDangerZone } from "@/components/admin/client-danger-zone";
import { ClientSignInSettings } from "@/components/admin/client-sign-in-settings";
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

  return (
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

      <Card>
        <CardHeader>
          <CardTitle>Edit {client.name}</CardTitle>
          <CardDescription>
            Update your OAuth client application settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 rounded-lg bg-muted">
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

      <ClientSignInSettings
        clientId={client.id}
        initialPermission={client.signInPermission as "all" | "none" | "whitelist"}
        initialEmails={whitelistEmails}
      />

      <ClientDangerZone clientId={client.id} clientName={client.name} />
    </div>
  );
}
