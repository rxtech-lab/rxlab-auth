import Link from "next/link";
import {
  User,
  KeyRound,
  AppWindow,
  LayoutDashboard,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./types";

const iconMap: Record<string, typeof User> = {
  User,
  KeyRound,
  AppWindow,
  LayoutDashboard,
  Shield,
};

interface SidebarNavProps {
  navItems: NavItem[];
  currentPath: string;
}

export function SidebarNav({ navItems, currentPath }: SidebarNavProps) {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-1">
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
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
