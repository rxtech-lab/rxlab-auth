import Link from "next/link";
import { db } from "@/lib/db";
import { oauthClients, users, oauthConsents } from "@/lib/db/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Key, Plus } from "lucide-react";
import { count } from "drizzle-orm";

export const metadata = {
  title: "Dashboard - Admin",
  description: "Admin dashboard overview",
};

export default async function AdminDashboardPage() {
  // Get counts
  const [clientCount] = await db.select({ count: count() }).from(oauthClients);
  const [userCount] = await db.select({ count: count() }).from(users);
  const [consentCount] = await db.select({ count: count() }).from(oauthConsents);

  const stats = [
    {
      label: "OAuth Clients",
      value: clientCount.count,
      icon: Shield,
      href: "/admin/dashboard/clients",
    },
    {
      label: "Users",
      value: userCount.count,
      icon: Users,
      href: "#",
    },
    {
      label: "Active Consents",
      value: consentCount.count,
      icon: Key,
      href: "#",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your OAuth server
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Quick Actions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/admin/dashboard/clients/new">
            <Button>
              <Plus className="w-4 h-4" />
              Create OAuth Client
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
