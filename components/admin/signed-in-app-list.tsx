import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Shield } from "lucide-react";
import type { SignedInApp } from "@/lib/admin/sign-in-history";

interface SignedInAppListProps {
  apps: SignedInApp[];
}

export function SignedInAppList({ apps }: SignedInAppListProps) {
  if (apps.length === 0) {
    return (
      <div
        className="py-8 text-center text-muted-foreground"
        data-testid="signed-in-apps-empty"
      >
        <p>No signed-in applications.</p>
        <p className="text-sm">
          Applications will appear after this user signs in.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y" data-testid="signed-in-app-list">
      {apps.map((app) => (
        <Link
          key={app.clientId}
          href={`/admin/dashboard/clients/${app.clientId}`}
          className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          data-testid={`signed-in-app-${app.clientId}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {app.iconUrl ? (
              <Image
                src={app.iconUrl}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                <Shield className="size-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{app.name}</p>
              {app.description && (
                <p className="truncate text-sm text-muted-foreground">
                  {app.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 self-end text-right sm:self-auto">
            <div>
              <p className="text-xs text-muted-foreground">Last signed in</p>
              <time
                dateTime={app.signedInAt.toISOString()}
                className="text-sm text-foreground"
              >
                {app.signedInAt.toLocaleString()}
              </time>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
      ))}
    </div>
  );
}
