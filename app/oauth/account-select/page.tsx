import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { oauthClients, users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { AccountSelectCard } from "@/components/auth/account-select-card";
import { eq } from "drizzle-orm";

interface PageProps {
  searchParams: Promise<{
    client_id?: string;
    redirect_uri?: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    nonce?: string;
    response_type?: string;
  }>;
}

export default async function AccountSelectPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Validate required params
  if (
    !params.client_id ||
    !params.redirect_uri ||
    !params.scope ||
    !params.code_challenge ||
    !params.code_challenge_method
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-semibold text-destructive">
            Invalid Request
          </h1>
          <p className="text-muted-foreground text-[15px]">
            Missing required parameters
          </p>
        </div>
      </div>
    );
  }

  // Check authentication
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    const loginUrl = new URL("/login", process.env.NEXT_PUBLIC_APP_URL);
    loginUrl.searchParams.set(
      "redirect",
      `/api/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`
    );
    redirect(loginUrl.toString());
  }

  // Get user info
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { email: true },
  });

  if (!user) {
    redirect("/login");
  }

  // Get client info
  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, params.client_id),
    columns: { name: true, iconUrl: true },
  });

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-semibold text-destructive">
            Invalid Client
          </h1>
          <p className="text-muted-foreground text-[15px]">
            The requested application was not found
          </p>
        </div>
      </div>
    );
  }

  // Build the params to pass to the client component
  const oauthParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      oauthParams[key] = value;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <AccountSelectCard
        email={user.email}
        client={{
          name: client.name,
          iconUrl: client.iconUrl,
        }}
        oauthParams={oauthParams}
      />
    </div>
  );
}
