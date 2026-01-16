import { db } from "@/lib/db";
import { AdminPasskeyCard } from "@/components/admin/admin-passkey-card";
import { AddAdminPasskeyButton } from "@/components/admin/add-admin-passkey-button";
import { PageHeader } from "@/components/dashboard";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Admin Passkeys - Admin Dashboard",
  description: "Manage admin passkeys for passwordless sign-in",
};

export default async function AdminPasskeysPage() {
  const allPasskeys = await db.query.adminPasskeys.findMany({
    orderBy: (adminPasskeys, { desc }) => [desc(adminPasskeys.createdAt)],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Passkeys"
        description="Manage passkeys for passwordless admin sign-in"
      >
        <AddAdminPasskeyButton />
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {allPasskeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No passkeys registered yet.</p>
              <p className="text-sm">
                Add a passkey to enable passwordless admin sign-in.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allPasskeys.map((passkey) => (
                <AdminPasskeyCard
                  key={passkey.id}
                  passkey={{
                    id: passkey.id,
                    name: passkey.name,
                    createdAt: passkey.createdAt,
                    lastUsedAt: passkey.lastUsedAt,
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">About Admin Passkeys</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Passkeys provide a secure, passwordless way to sign in to the admin panel</li>
              <li>You can use both password and passkey authentication</li>
              <li>Passkeys are stored on your device and protected by biometrics or PIN</li>
              <li>If you delete all passkeys, you can still sign in with the admin password</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
