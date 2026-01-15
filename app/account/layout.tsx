import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { QueryProvider } from "@/providers/query-provider";
import { SessionProvider } from "@/providers/session-provider";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/auth/logout";
import { User, KeyRound, Grid3X3, LogOut } from "lucide-react";
import { eq } from "drizzle-orm";

const navItems = [
  { href: "/account", label: "Profile", icon: User },
  { href: "/account/passkeys", label: "Passkeys", icon: KeyRound },
  { href: "/account/apps", label: "Connected Apps", icon: Grid3X3 },
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
      emailVerified: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

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
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
          <header className="border-b">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
              <Link href="/account" className="font-bold text-lg">
                {process.env.NEXT_PUBLIC_APP_NAME || "RxLab Auth"}
              </Link>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <img
                    src={`/api/avatar/${user.avatarSeed || user.id}`}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm font-medium hidden sm:block">
                    {user.displayName || user.email}
                  </span>
                </div>
                <form action={logout}>
                  <Button type="submit" variant="ghost" size="sm">
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign out</span>
                  </Button>
                </form>
              </div>
            </div>
          </header>

          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row gap-8">
              <aside className="w-full md:w-64 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </aside>
              <main className="flex-1 max-w-2xl">{children}</main>
            </div>
          </div>
        </div>
      </SessionProvider>
    </QueryProvider>
  );
}
