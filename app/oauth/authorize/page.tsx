import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { parseScopes } from "@/lib/validations/oauth";
import { OAuthConsentCard } from "@/components/auth/oauth-consent-card";
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
  }>;
}

export default async function OAuthConsentPage({ searchParams }: PageProps) {
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
          <h1 className="text-3xl font-semibold text-destructive">Invalid Request</h1>
          <p className="text-muted-foreground text-[15px]">Missing required parameters</p>
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
      `/oauth/authorize?${new URLSearchParams(params as Record<string, string>).toString()}`
    );
    redirect(loginUrl.toString());
  }

  // Get client
  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, params.client_id),
  });

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-semibold text-destructive">Invalid Client</h1>
          <p className="text-muted-foreground text-[15px]">The requested application was not found</p>
        </div>
      </div>
    );
  }

  const scopes = parseScopes(params.scope);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <OAuthConsentCard
        client={{
          id: client.id,
          name: client.name,
          description: client.description,
          iconUrl: client.iconUrl,
        }}
        scopes={scopes}
        params={{
          clientId: params.client_id,
          redirectUri: params.redirect_uri,
          scope: params.scope,
          state: params.state,
          codeChallenge: params.code_challenge,
          codeChallengeMethod: params.code_challenge_method,
          nonce: params.nonce,
        }}
      />
    </div>
  );
}
