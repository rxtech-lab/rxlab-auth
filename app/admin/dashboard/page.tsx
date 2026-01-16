import Link from "next/link";
import { db } from "@/lib/db";
import { oauthClients, users, oauthConsents } from "@/lib/db/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, StatsCard } from "@/components/dashboard";
import { Shield, Users, Key, Plus } from "lucide-react";
import { count } from "drizzle-orm";

export const metadata = {
  title: "Dashboard - Admin",
  description: "Admin dashboard overview",
};

export default async function AdminDashboardPage() {
  const [clientCount] = await db.select({ count: count() }).from(oauthClients);
  const [userCount] = await db.select({ count: count() }).from(users);
  const [consentCount] = await db.select({ count: count() }).from(oauthConsents);

  const stats = [
    { label: "OAuth Clients", value: clientCount.count, icon: Shield },
    { label: "Users", value: userCount.count, icon: Users },
    { label: "Active Consents", value: consentCount.count, icon: Key },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your OAuth server"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <StatsCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/admin/dashboard/clients/new">
            <Button>
              <Plus className="h-4 w-4" />
              Create OAuth Client
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
