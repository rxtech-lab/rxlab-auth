import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/auth/session";
import { QueryProvider } from "@/providers/query-provider";
import { Button } from "@/components/ui/button";
import { adminLogout } from "@/actions/admin/logout";
import { Shield, Grid3X3, LogOut } from "lucide-react";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session.isAdmin) {
    redirect("/admin");
  }

  return (
    <QueryProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <header className="border-b">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">Admin Panel</span>
            </div>
            <form action={adminLogout}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
            </form>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            <aside className="w-full md:w-64 space-y-1">
              <Link href="/admin/dashboard">
                <Button variant="ghost" className="w-full justify-start">
                  <Grid3X3 className="w-4 h-4" />
                  Overview
                </Button>
              </Link>
              <Link href="/admin/dashboard/clients">
                <Button variant="ghost" className="w-full justify-start">
                  <Shield className="w-4 h-4" />
                  OAuth Clients
                </Button>
              </Link>
            </aside>
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </div>
    </QueryProvider>
  );
}
