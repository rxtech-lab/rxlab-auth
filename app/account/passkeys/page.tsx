import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { passkeys } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { PasskeyCard } from "@/components/account/passkey-card";
import { AddPasskeyButton } from "@/components/account/add-passkey-button";
import { PageHeader } from "@/components/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { eq } from "drizzle-orm";

export const metadata = {
  title: "Passkeys - Account",
  description: "Manage your passkeys",
};

export default async function PasskeysPage() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }

  const userPasskeys = await db.query.passkeys.findMany({
    where: eq(passkeys.userId, session.userId),
    orderBy: (passkeys, { desc }) => [desc(passkeys.createdAt)],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Passkeys"
        description="Manage your passkeys for passwordless sign-in"
      >
        <AddPasskeyButton />
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {userPasskeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No passkeys registered yet.</p>
              <p className="text-sm">
                Add a passkey to enable passwordless sign-in.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {userPasskeys.map((passkey) => (
                <PasskeyCard
                  key={passkey.id}
                  passkey={{
                    id: passkey.id,
                    name: passkey.name,
                    deviceType: passkey.deviceType,
                    backedUp: passkey.backedUp,
                    createdAt: passkey.createdAt,
                    lastUsedAt: passkey.lastUsedAt,
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
