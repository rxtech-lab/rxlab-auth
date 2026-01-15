import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { ProfileForm } from "@/components/account/profile-form";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { eq } from "drizzle-orm";

export const metadata = {
  title: "Profile - Account",
  description: "Manage your profile settings",
};

export default async function AccountPage() {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Manage your account information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm
          user={{
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            avatarSeed: user.avatarSeed,
          }}
        />
      </CardContent>
    </Card>
  );
}
