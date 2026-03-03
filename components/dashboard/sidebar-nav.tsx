"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Users,
  KeyRound,
  AppWindow,
  LayoutDashboard,
  Shield,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./types";

const iconMap: Record<string, typeof User> = {
  User,
  Users,
  KeyRound,
  AppWindow,
  LayoutDashboard,
  Shield,
  Settings,
};

interface SidebarNavProps {
  navItems: NavItem[];
}

export function SidebarNav({ navItems }: SidebarNavProps) {
  const currentPath = usePathname();
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-1 sticky top-24 self-start">
      {navItems.map((item) => {
        const Icon = iconMap[item.iconName] || User;
        const isActive =
          currentPath === item.href ||
          (item.href !== "/" &&
            item.href !== "/admin/dashboard" &&
            item.href !== "/account" &&
            currentPath.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4.5 w-4.5" />
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
