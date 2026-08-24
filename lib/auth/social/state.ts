import { jwtVerify, SignJWT } from "jose";
import type { SocialProviderId } from "@/lib/auth/social/providers";

const STATE_TTL_SECONDS = 10 * 60;

export interface SocialOAuthState {
  provider: SocialProviderId;
  state: string;
  redirectTo: string;
}

function signingKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required");
  return new TextEncoder().encode(secret);
}

export function sanitizeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }
  return value;
}

export function socialStateCookieName(provider: SocialProviderId): string {
  return `rxlab-social-oauth-${provider}`;
}

export async function createSocialOAuthState(input: {
  provider: SocialProviderId;
  redirectTo: string;
}): Promise<{ state: string; token: string }> {
  const state = crypto.randomUUID();
  const redirectTo = sanitizeRedirectPath(input.redirectTo);
  const token = await new SignJWT({
    provider: input.provider,
    redirectTo,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(state)
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(signingKey());

  return { state, token };
}

export async function verifySocialOAuthState(input: {
  provider: SocialProviderId;
  state: string;
  token: string;
}): Promise<SocialOAuthState> {
  const { payload } = await jwtVerify(input.token, signingKey(), {
    algorithms: ["HS256"],
  });
  if (
    payload.sub !== input.state ||
    payload.provider !== input.provider ||
    typeof payload.redirectTo !== "string"
  ) {
    throw new Error("Invalid OAuth state");
  }

  return {
    provider: input.provider,
    state: input.state,
    redirectTo: sanitizeRedirectPath(payload.redirectTo),
  };
}
