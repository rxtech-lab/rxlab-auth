import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { oauthConsents, oauthClients } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { ConnectedAppCard } from "@/components/account/connected-app-card";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { eq } from "drizzle-orm";

export const metadata = {
  title: "Connected Apps - Account",
  description: "Manage applications connected to your account",
};

export default async function ConnectedAppsPage() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }

  const consents = await db.query.oauthConsents.findMany({
    where: eq(oauthConsents.userId, session.userId),
    orderBy: (oauthConsents, { desc }) => [desc(oauthConsents.createdAt)],
  });

  // Fetch client info for each consent
  const consentsWithClients = await Promise.all(
    consents.map(async (consent) => {
      const client = await db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, consent.clientId),
      });

      return {
        ...consent,
        scopes: JSON.parse(consent.scopes) as string[],
        client: client
          ? {
              name: client.name,
              description: client.description,
              iconUrl: client.iconUrl,
            }
          : {
              name: "Unknown App",
              description: null,
              iconUrl: null,
            },
      };
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Apps</CardTitle>
        <CardDescription>
          Applications that have access to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {consentsWithClients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No connected applications.</p>
            <p className="text-sm">
              When you authorize applications, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {consentsWithClients.map((consent) => (
              <ConnectedAppCard key={consent.id} consent={consent} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
