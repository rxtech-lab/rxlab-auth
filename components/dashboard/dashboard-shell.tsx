import { headers } from "next/headers";
import { DashboardHeader } from "./dashboard-header";
import { SidebarNav } from "./sidebar-nav";
import type { NavItem } from "./types";

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  logo?: React.ReactNode;
  navItems: NavItem[];
  headerRight: React.ReactNode;
  homeHref: string;
}

export async function DashboardShell({
  children,
  title,
  logo,
  navItems,
  headerRight,
  homeHref,
}: DashboardShellProps) {
  const headersList = await headers();
  const currentPath = headersList.get("x-pathname") || "/";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title={title}
        logo={logo}
        navItems={navItems}
        headerRight={headerRight}
        homeHref={homeHref}
      />

      <div className="container mx-auto flex gap-8 px-4 py-6 sm:px-6 lg:py-8">
        <SidebarNav navItems={navItems} currentPath={currentPath} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
