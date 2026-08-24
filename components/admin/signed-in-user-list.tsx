import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, UserRound } from "lucide-react";
import type { SignedInUser } from "@/lib/admin/sign-in-history";

interface SignedInUserListProps {
  users: SignedInUser[];
}

export function SignedInUserList({ users }: SignedInUserListProps) {
  if (users.length === 0) {
    return (
      <div
        className="py-8 text-center text-muted-foreground"
        data-testid="signed-in-users-empty"
      >
        <p>No signed-in users.</p>
        <p className="text-sm">
          Users will appear after they sign in to this application.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y" data-testid="signed-in-user-list">
      {users.map((user) => (
        <Link
          key={user.userId}
          href={`/admin/dashboard/users/${user.userId}`}
          className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          data-testid={`signed-in-user-${user.userId}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserRound className="size-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {user.displayName || user.email}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 self-end text-right sm:self-auto">
            <div>
              <p className="text-xs text-muted-foreground">Last signed in</p>
              <time
                dateTime={user.signedInAt.toISOString()}
                className="text-sm text-foreground"
                suppressHydrationWarning
              >
                {user.signedInAt.toLocaleString()}
              </time>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
      ))}
    </div>
  );
}
