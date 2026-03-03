"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  User,
  KeyRound,
  AppWindow,
  LayoutDashboard,
  Shield,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavItem } from "./types";

const iconMap: Record<string, typeof User> = {
  User,
  KeyRound,
  AppWindow,
  LayoutDashboard,
  Shield,
};

interface MobileNavProps {
  navItems: NavItem[];
  title: string;
  logo?: React.ReactNode;
}

export function MobileNav({ navItems, title, logo }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="md:hidden" />
        }
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
        <SheetHeader className="shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)] px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            {logo}
            <span>{title}</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const Icon = iconMap[item.iconName] || User;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" &&
                item.href !== "/admin/dashboard" &&
                item.href !== "/account" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
        </nav>
      </SheetContent>
    </Sheet>
  );
}
