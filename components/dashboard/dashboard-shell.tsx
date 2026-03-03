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

export function DashboardShell({
  children,
  title,
  logo,
  navItems,
  headerRight,
  homeHref,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title={title}
        logo={logo}
        navItems={navItems}
        headerRight={headerRight}
        homeHref={homeHref}
      />

      <div className="container mx-auto flex gap-10 px-4 py-8 sm:px-6 lg:py-10">
        <SidebarNav navItems={navItems} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
