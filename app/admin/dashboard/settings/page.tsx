import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard";
import { SignUpSettingsCard } from "@/components/admin/sign-up-settings-card";
import { EmailWhitelistCard } from "@/components/admin/email-whitelist-card";

export const metadata = {
  title: "Settings - Admin Dashboard",
  description: "Manage application settings",
};

export default async function SettingsPage() {
  // Fetch current settings
  const settings = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, "global"),
  });

  const whitelistedEmails = await db.query.emailWhitelist.findMany({
    orderBy: (emailWhitelist, { desc }) => [desc(emailWhitelist.createdAt)],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage sign-up and access controls"
      />

      <SignUpSettingsCard
        initialSettings={{
          signUpEnabled: settings?.signUpEnabled ?? true,
          signUpWhitelistEnabled: settings?.signUpWhitelistEnabled ?? false,
        }}
      />

      <EmailWhitelistCard
        initialEmails={whitelistedEmails}
        whitelistEnabled={settings?.signUpWhitelistEnabled ?? false}
      />
    </div>
  );
}
