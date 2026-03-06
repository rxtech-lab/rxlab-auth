import { redirect } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { QueryProvider } from "@/providers/query-provider";
import { SessionProvider } from "@/providers/session-provider";
import { DashboardShell, type NavItem } from "@/components/dashboard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/actions/auth/logout";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { eq } from "drizzle-orm";

const navItems: NavItem[] = [
  { href: "/account", label: "Profile", iconName: "User" },
  { href: "/account/passkeys", label: "Passkeys", iconName: "KeyRound" },
  { href: "/account/apps", label: "Connected Apps", iconName: "AppWindow" },
];

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      avatarSeed: true,
      avatarUrl: true,
      emailVerified: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const headerRight = (
    <>
    <ThemeToggle />
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <Image
          src={user.avatarUrl || `/api/avatar/${user.avatarSeed || user.id}`}
          alt="Avatar"
          width={32}
          height={32}
          className="rounded-full cursor-pointer"
          unoptimized
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium leading-none">
            {user.displayName || user.username || "User"}
          </p>
          <p className="text-xs leading-none text-muted-foreground mt-1">
            {user.email}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <form action={logout} className="w-full">
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );

  return (
    <QueryProvider>
      <SessionProvider
        initialUser={{
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          avatarSeed: user.avatarSeed,
          emailVerified: user.emailVerified ?? false,
        }}
      >
        <DashboardShell
          title={process.env.NEXT_PUBLIC_APP_NAME || "RxLab Auth"}
          navItems={navItems}
          headerRight={headerRight}
          homeHref="/account"
        >
          {children}
        </DashboardShell>
      </SessionProvider>
    </QueryProvider>
  );
}
