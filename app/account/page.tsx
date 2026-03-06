import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { ProfileForm } from "@/components/account/profile-form";
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
              email: user.email,
              username: user.username,
              displayName: user.displayName,
              avatarSeed: user.avatarSeed,
              avatarUrl: user.avatarUrl,
            }}
          />
        </CardContent>
      </Card>

      {showPasskeySetup && <PasskeySetupPrompt />}
    </div>
  );
}
