import { jwtVerify, SignJWT } from "jose";
import {
  usesFormPostCallback,
  type SocialProviderId,
} from "@/lib/auth/social/providers";

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

/**
 * Cookie attributes for the one-shot OAuth state token.
 *
 * `SameSite=Lax` is right for the redirect-based providers: the callback is a
 * top-level GET, so the cookie rides along. Apple, though, returns the result
 * as a cross-site form POST (`response_mode=form_post`), and Lax deliberately
 * withholds cookies from cross-site POSTs — the state cookie would simply be
 * absent and every sign-in would fail CSRF validation. `SameSite=None` is the
 * only setting that survives that, and it requires `Secure`, which is why the
 * Apple browser flow needs HTTPS even locally (use a tunnel).
 *
 * The cookie stays scoped to the single callback path and lives 10 minutes, so
 * widening SameSite doesn't widen its reach: it is never sent anywhere except
 * the endpoint that immediately consumes and clears it.
 */
export function socialStateCookieOptions(provider: SocialProviderId) {
  const crossSite = usesFormPostCallback(provider);
  return {
    httpOnly: true,
    sameSite: crossSite ? ("none" as const) : ("lax" as const),
    secure: crossSite || process.env.NODE_ENV === "production",
    path: `/api/auth/social/${provider}/callback`,
    maxAge: STATE_TTL_SECONDS,
  };
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
