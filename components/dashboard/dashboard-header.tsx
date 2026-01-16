import Link from "next/link";
import { MobileNav } from "./mobile-nav";
import type { NavItem } from "./types";

interface DashboardHeaderProps {
  title: string;
  logo?: React.ReactNode;
  navItems: NavItem[];
  headerRight: React.ReactNode;
  homeHref: string;
}

export function DashboardHeader({
  title,
  logo,
  navItems,
  headerRight,
  homeHref,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center gap-4 px-4 sm:px-6">
        <MobileNav navItems={navItems} title={title} logo={logo} />

        <Link
          href={homeHref}
          className="flex items-center gap-2 font-semibold"
        >
          {logo}
          <span className="hidden sm:inline-block">{title}</span>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-2">{headerRight}</div>
      </div>
    </header>
  );
}
