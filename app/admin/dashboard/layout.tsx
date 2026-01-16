import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { QueryProvider } from "@/providers/query-provider";
import { DashboardShell, type NavItem } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { adminLogout } from "@/actions/admin/logout";
import { Shield, LogOut } from "lucide-react";

const navItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Overview", iconName: "LayoutDashboard" },
  { href: "/admin/dashboard/clients", label: "OAuth Clients", iconName: "Shield" },
  { href: "/admin/dashboard/passkeys", label: "Passkeys", iconName: "KeyRound" },
];

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session.isAdmin) {
    redirect("/admin");
  }

  const headerRight = (
    <form action={adminLogout}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline-block">Sign out</span>
      </Button>
    </form>
  );

  return (
    <QueryProvider>
      <DashboardShell
        title="Admin Panel"
        logo={<Shield className="h-5 w-5 text-primary" />}
        navItems={navItems}
        headerRight={headerRight}
        homeHref="/admin/dashboard"
      >
        {children}
      </DashboardShell>
    </QueryProvider>
  );
}
