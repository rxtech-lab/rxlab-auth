import Link from "next/link";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { ClientCard } from "@/components/admin/client-card";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = {
  title: "OAuth Clients - Admin",
  description: "Manage OAuth client applications",
};

export default async function ClientsPage() {
  const clients = await db.query.oauthClients.findMany({
    orderBy: (oauthClients, { desc }) => [desc(oauthClients.createdAt)],
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>OAuth Clients</CardTitle>
          <CardDescription>
            Manage your registered OAuth applications
          </CardDescription>
        </div>
        <Link href="/admin/dashboard/clients/new">
          <Button>
            <Plus className="w-4 h-4" />
            New Client
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No OAuth clients registered yet.</p>
            <p className="text-sm">
              Create your first client to enable OAuth authentication.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={{
                  id: client.id,
                  name: client.name,
                  description: client.description,
                  iconUrl: client.iconUrl,
                  isFirstParty: client.isFirstParty ?? false,
                  createdAt: client.createdAt,
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
