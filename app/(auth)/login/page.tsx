import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { LoginForm } from "@/components/auth/login-form";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { getEnabledSocialProviders } from "@/lib/auth/social/providers";
import {
  DEFAULT_SIGN_IN_METHODS,
  filterSocialProviders,
  parseSignInMethods,
} from "@/lib/auth/sign-in-methods";

export const metadata = {
  title: "Sign In - RxLab Auth",
  description: "Sign in to your account",
};

function LoginFormFallback() {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * When the user arrived from /oauth/authorize, the `redirect` param still holds
 * that URL — and with it the client_id — so the form can be narrowed to the
 * methods that client actually allows.
 *
 * This is PRESENTATIONAL ONLY. `redirect` is user-supplied and `actions/auth/login.ts`
 * has no client context at all, so nothing here is a security boundary: a
 * crafted `redirect` can only change which buttons this page draws. Real
 * enforcement lives where client_id is authenticated — /api/oauth/authorize,
 * /api/oauth/token, and the native routes via requireSignInMethod().
 */
async function resolveClientMethods(redirect: string | undefined) {
  if (!redirect) return DEFAULT_SIGN_IN_METHODS;

  let clientId: string | null = null;
  try {
    clientId = new URL(redirect, "http://localhost").searchParams.get("client_id");
  } catch {
    return DEFAULT_SIGN_IN_METHODS;
  }
  if (!clientId) return DEFAULT_SIGN_IN_METHODS;

  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, clientId),
    columns: { signInMethods: true },
  });
  if (!client) return DEFAULT_SIGN_IN_METHODS;

  return parseSignInMethods(client.signInMethods);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const allowedMethods = await resolveClientMethods(redirect);

  const socialProviders = filterSocialProviders(
    getEnabledSocialProviders(),
    allowedMethods,
  );

  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm
        socialProviders={socialProviders}
        passwordEnabled={allowedMethods.password}
        passkeyEnabled={allowedMethods.passkey}
      />
    </Suspense>
  );
}
