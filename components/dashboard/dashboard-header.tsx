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
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4 sm:px-6">
        <MobileNav navItems={navItems} title={title} logo={logo} />

        <Link
          href={homeHref}
          className="flex items-center gap-2.5 font-semibold text-[15px]"
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
