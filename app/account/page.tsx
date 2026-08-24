import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { passkeys, socialAccounts, users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { ProfileForm } from "@/components/account/profile-form";
import { SocialAccountCard } from "@/components/account/social-account-card";
import { PasskeySetupPrompt } from "@/components/account/passkey-setup-prompt";
import { PageHeader } from "@/components/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { eq } from "drizzle-orm";

export const metadata = {
  title: "Profile - Account",
  description: "Manage your profile settings",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const showPasskeySetup = params.setup === "passkey";
  const [connectedSocialAccounts, userPasskeys] = await Promise.all([
    db.query.socialAccounts.findMany({
      where: eq(socialAccounts.userId, user.id),
      orderBy: (socialAccounts, { asc }) => [asc(socialAccounts.provider)],
    }),
    db.query.passkeys.findMany({
      where: eq(passkeys.userId, user.id),
      columns: { id: true },
    }),
  ]);
  const canDisconnectSocialAccount =
    Boolean(user.passwordHash) ||
    userPasskeys.length > 0 ||
    connectedSocialAccounts.length > 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your account information"
      />

      <Card>
        <CardContent className="pt-6">
          <ProfileForm
            user={{
              id: user.id,
              email: user.email,
              username: user.username,
              displayName: user.displayName,
              avatarSeed: user.avatarSeed,
              avatarUrl: user.avatarUrl,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="font-semibold">Connected social accounts</h2>
            <p className="text-sm text-muted-foreground">
              Social accounts you can use to sign in.
            </p>
          </div>

          {connectedSocialAccounts.length === 0 ? (
            <div className="rounded-2xl bg-muted/50 py-8 text-center text-muted-foreground">
              <p>No social accounts connected.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connectedSocialAccounts.map((account) => (
                <SocialAccountCard
                  key={account.id}
                  account={{
                    provider: account.provider,
                    providerEmail: account.providerEmail,
                    createdAt: account.createdAt,
                  }}
                  canDisconnect={canDisconnectSocialAccount}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showPasskeySetup && <PasskeySetupPrompt />}
    </div>
  );
}
