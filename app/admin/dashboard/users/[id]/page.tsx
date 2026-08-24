import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getUserSignedInApps } from "@/lib/admin/sign-in-history";
import { PageHeader } from "@/components/dashboard";
import { SignedInAppList } from "@/components/admin/signed-in-app-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const user = await db.query.users.findFirst({
    columns: { email: true, displayName: true },
    where: eq(users.id, id),
  });

  if (!user) {
    return { title: "User Not Found" };
  }

  return {
    title: `${user.displayName || user.email} - Admin`,
    description: `View ${user.email} and their signed-in applications`,
  };
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (!user) {
    notFound();
  }

  const signedInApps = await getUserSignedInApps(user.id);

  return (
    <div className="space-y-6">
      <div>
        <Button
          render={<Link href="/admin/dashboard/users" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-3 mb-2"
        >
          <ArrowLeft className="size-4" />
          Back to users
        </Button>
        <PageHeader
          title={user.displayName || user.email}
          description={user.email}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User details</CardTitle>
          <CardDescription>Account identity and status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="mt-1 break-all font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Username</p>
            <p className="mt-1 font-medium">
              {user.username ? `@${user.username}` : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1">
              {user.emailVerified ? (
                <Badge className="gap-1">
                  <CheckCircle className="size-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="size-3" />
                  Unverified
                </Badge>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <time
              dateTime={user.createdAt.toISOString()}
              className="mt-1 block font-medium"
            >
              {user.createdAt.toLocaleString()}
            </time>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signed-in applications</CardTitle>
          <CardDescription>
            {signedInApps.length}{" "}
            {signedInApps.length === 1 ? "application" : "applications"} this
            user has signed in to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignedInAppList apps={signedInApps} />
        </CardContent>
      </Card>
    </div>
  );
}
