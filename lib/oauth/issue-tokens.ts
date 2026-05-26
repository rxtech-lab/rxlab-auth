import { db } from "@/lib/db";
import { oauthRefreshTokens } from "@/lib/db/schema";
import {
  signAccessToken,
  signIdToken,
  generateRefreshToken,
} from "@/lib/oauth/jwt";

const ACCESS_TOKEN_EXPIRES_IN = 3600;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface TokenSubject {
  id: string;
  email: string;
  emailVerified?: boolean | null;
  displayName?: string | null;
  username?: string | null;
  avatarSeed?: string | null;
  avatarUrl?: string | null;
}

export interface TokenClient {
  id: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
  id_token?: string;
}

// Single canonical token-issuance path used by every non-authorization_code
// grant (password, signup, passkey native sign-in, passkey native sign-up).
// Inserts a refresh-token row, signs an access token, and conditionally an
// id_token when `openid` is granted. Shape matches /api/oauth/token's
// authorization_code response.
export async function issueOAuthTokenResponse(params: {
  user: TokenSubject;
  client: TokenClient;
  scopes: string[];
}): Promise<OAuthTokenResponse> {
  const { user, client, scopes } = params;
  const scopeString = scopes.join(" ");

  const accessToken = await signAccessToken({
    sub: user.id,
    client_id: client.id,
    scope: scopeString,
  });

  let idToken: string | undefined;
  if (scopes.includes("openid")) {
    idToken = await signIdToken(
      {
        sub: user.id,
        email: scopes.includes("email") ? user.email : undefined,
        email_verified: scopes.includes("email")
          ? (user.emailVerified ?? false)
          : undefined,
        name: user.displayName ?? undefined,
        preferred_username: user.username ?? undefined,
        picture:
          user.avatarUrl ||
          `${process.env.OAUTH_ISSUER_URL}/api/avatar/${user.avatarSeed || user.id}`,
        auth_time: Math.floor(Date.now() / 1000),
      },
      client.id,
    );
  }

  const refreshToken = generateRefreshToken();
  await db.insert(oauthRefreshTokens).values({
    id: crypto.randomUUID(),
    token: refreshToken,
    userId: user.id,
    clientId: client.id,
    scopes: JSON.stringify(scopes),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    createdAt: new Date(),
  });

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_EXPIRES_IN,
    ...(idToken ? { id_token: idToken } : {}),
    scope: scopeString,
    refresh_token: refreshToken,
  };
}
