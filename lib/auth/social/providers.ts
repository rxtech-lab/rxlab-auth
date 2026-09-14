import { z } from "zod";
import { emailSchema } from "@/lib/validations/auth";
import {
  createAppleClientSecret,
  getAppleSigningCredentials,
} from "@/lib/auth/social/apple-client-secret";
import {
  appleDisplayName,
  verifyAppleIdentityToken,
  type AppleUserPayload,
} from "@/lib/auth/social/apple-identity-token";

export const SOCIAL_PROVIDER_IDS = ["github", "google", "apple"] as const;

export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

export interface SocialProviderDescriptor {
  id: SocialProviderId;
  label: string;
  iconPath: string;
  darkIconPath: string;
}

export interface SocialProfile {
  provider: SocialProviderId;
  providerAccountId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface SocialProviderConfig extends SocialProviderDescriptor {
  clientId: string;
  // GitHub and Google hand out a static secret. Apple's is an ES256 JWT we mint
  // per exchange from a .p8 key, so the value is resolved lazily rather than
  // read off the config — see lib/auth/social/apple-client-secret.ts.
  resolveClientSecret: () => Promise<string>;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userEndpoint: string;
  emailsEndpoint?: string;
  scopes: string[];
}

export class SocialProviderError extends Error {
  constructor(
    public readonly code:
      | "provider_unavailable"
      | "provider_response_invalid"
      | "verified_email_required",
  ) {
    super(code);
    this.name = "SocialProviderError";
  }
}

const PROVIDER_METADATA: Record<
  SocialProviderId,
  Omit<SocialProviderConfig, "clientId" | "resolveClientSecret">
> = {
  github: {
    id: "github",
    label: "Continue with GitHub",
    iconPath: "/brand/github-invertocat-black.svg",
    darkIconPath: "/brand/github-invertocat-white.svg",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    userEndpoint: "https://api.github.com/user",
    emailsEndpoint: "https://api.github.com/user/emails",
    scopes: ["user:email"],
  },
  google: {
    id: "google",
    label: "Continue with Google",
    iconPath: "/brand/google-g.svg",
    darkIconPath: "/brand/google-g.svg",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    userEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  apple: {
    id: "apple",
    label: "Continue with Apple",
    iconPath: "/brand/apple-logo-black.svg",
    darkIconPath: "/brand/apple-logo-white.svg",
    authorizationEndpoint: "https://appleid.apple.com/auth/authorize",
    tokenEndpoint: "https://appleid.apple.com/auth/token",
    // Apple has no userinfo endpoint — the profile comes out of the id_token.
    userEndpoint: "",
    scopes: ["name", "email"],
  },
};

const githubTokenSchema = z.object({
  access_token: z.string().min(1),
});

const githubUserSchema = z.object({
  id: z.number().int(),
  login: z.string().min(1),
  name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

const githubEmailsSchema = z.array(
  z.object({
    email: z.string(),
    primary: z.boolean(),
    verified: z.boolean(),
  }),
);

const googleTokenSchema = z.object({
  access_token: z.string().min(1),
});

const googleUserSchema = z.object({
  sub: z.string().min(1),
  email: z.string(),
  email_verified: z.boolean(),
  name: z.string().nullable().optional(),
  picture: z.string().url().nullable().optional(),
});

const appleTokenSchema = z.object({
  id_token: z.string().min(1),
});

export function isSocialProviderId(value: string): value is SocialProviderId {
  return SOCIAL_PROVIDER_IDS.includes(value as SocialProviderId);
}

function resolveCredentials(
  provider: SocialProviderId,
): Pick<SocialProviderConfig, "clientId" | "resolveClientSecret"> | null {
  if (provider === "apple") {
    // Apple is "configured" when the whole signing quartet is present; the
    // secret itself is minted on demand at exchange time.
    const credentials = getAppleSigningCredentials();
    if (!credentials) return null;
    return {
      clientId: credentials.clientId,
      resolveClientSecret: () => createAppleClientSecret(),
    };
  }

  const { clientId, clientSecret } =
    provider === "github"
      ? {
          clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
          clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        }
      : {
          clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        };

  if (!clientId || !clientSecret) return null;
  return { clientId, resolveClientSecret: async () => clientSecret };
}

// One warning per process per reason, so a misconfiguration is obvious in the
// logs without every request reprinting it.
const warnedOnce = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  console.warn(message);
}

/**
 * Apple refuses any `redirect_uri` that isn't HTTPS, and refuses `localhost`
 * even over HTTPS — it answers with a bare `invalid_client` page that says
 * nothing about why. Rather than hand users a button that always dead-ends
 * there, treat an unusable issuer as "Apple isn't available here" and say so in
 * the logs.
 *
 * The browser flow is the only thing affected. Native Sign in with Apple has no
 * redirect URI at all, so POST /api/oauth/social/apple keeps working locally.
 */
function appleWebFlowUnusableReason(): string | null {
  // The e2e mock provider is a local HTTP server standing in for Apple; it has
  // none of these restrictions.
  if (
    process.env.SOCIAL_OAUTH_TEST_BASE_URL &&
    process.env.NODE_ENV !== "production"
  ) {
    return null;
  }

  let issuer: URL;
  try {
    issuer = new URL(getOAuthIssuerUrl());
  } catch {
    return "OAUTH_ISSUER_URL is not set or is not a valid URL";
  }

  if (issuer.protocol !== "https:") {
    return `OAUTH_ISSUER_URL is ${issuer.origin} — Apple requires an https redirect_uri`;
  }
  if (issuer.hostname === "localhost" || issuer.hostname === "127.0.0.1") {
    return `OAUTH_ISSUER_URL is ${issuer.origin} — Apple does not accept localhost redirect URIs`;
  }
  return null;
}

export function getSocialProvider(
  provider: SocialProviderId,
): SocialProviderConfig | null {
  const credentials = resolveCredentials(provider);
  if (!credentials) return null;

  const config: SocialProviderConfig = {
    ...PROVIDER_METADATA[provider],
    ...credentials,
  };

  const testBaseUrl = process.env.SOCIAL_OAUTH_TEST_BASE_URL;
  if (testBaseUrl && process.env.NODE_ENV !== "production") {
    const baseUrl = testBaseUrl.replace(/\/$/, "");
    config.authorizationEndpoint = `${baseUrl}/${provider}/authorize`;
    config.tokenEndpoint = `${baseUrl}/${provider}/token`;
    config.userEndpoint = `${baseUrl}/${provider}/user`;
    if (provider === "github") {
      config.emailsEndpoint = `${baseUrl}/github/emails`;
    }
  }

  return config;
}

/**
 * True when the provider posts its callback as a cross-site form submission
 * rather than a redirect with query params. Only Apple does this, and only
 * because asking for the `name`/`email` scopes forces `response_mode=form_post`
 * — which in turn forces `SameSite=None` on the state cookie.
 */
export function usesFormPostCallback(provider: SocialProviderId): boolean {
  return provider === "apple";
}

export function getEnabledSocialProviders(): SocialProviderDescriptor[] {
  return SOCIAL_PROVIDER_IDS.flatMap((provider) => {
    const config = getSocialProvider(provider);
    return config
      ? [
          {
            id: config.id,
            label: config.label,
            iconPath: config.iconPath,
            darkIconPath: config.darkIconPath,
          },
        ]
      : [];
  });
}

/**
 * The providers whose *browser* flow can actually complete right now.
 *
 * Only the web login form should use this. `getEnabledSocialProviders` stays
 * the answer for the UI schema, because a native client reaches Apple through
 * `POST /api/oauth/social/apple` — which has no redirect URI and so none of the
 * restrictions below. Hiding Apple from the schema on an http issuer would
 * break native sign-in during local development for no reason.
 */
export function getWebSocialProviders(): SocialProviderDescriptor[] {
  return getEnabledSocialProviders().filter((provider) => {
    if (provider.id !== "apple") return true;

    const reason = appleWebFlowUnusableReason();
    if (!reason) return true;

    warnOnce(
      `apple-web:${reason}`,
      `[social] Sign in with Apple is configured, but its browser flow cannot work here: ${reason}. ` +
        `The button is hidden on the web login page. Point OAUTH_ISSUER_URL at an https domain ` +
        `registered as a Return URL on your Services ID — a tunnel works for local development. ` +
        `Native Sign in with Apple (iOS/macOS) is unaffected.`,
    );
    return false;
  });
}

export function getOAuthIssuerUrl(): string {
  const configured =
    process.env.OAUTH_ISSUER_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) {
    throw new SocialProviderError("provider_unavailable");
  }

  const url = new URL(configured);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SocialProviderError("provider_unavailable");
  }
  return url.origin;
}

export function getSocialCallbackUrl(provider: SocialProviderId): string {
  return `${getOAuthIssuerUrl()}/api/auth/social/${provider}/callback`;
}

export function buildSocialAuthorizationUrl(input: {
  provider: SocialProviderId;
  state: string;
}): URL {
  const config = getSocialProvider(input.provider);
  if (!config) throw new SocialProviderError("provider_unavailable");

  if (input.provider === "apple") {
    // Apple answers an unusable redirect_uri with a bare `invalid_client` page
    // that explains nothing. Fail here instead, where the reason can be logged.
    const reason = appleWebFlowUnusableReason();
    if (reason) {
      console.error(
        `[social] Refusing to start the Apple browser flow: ${reason}. ` +
          `Apple would reject the request with "invalid_client".`,
      );
      throw new SocialProviderError("provider_unavailable");
    }
  }

  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", getSocialCallbackUrl(input.provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", input.state);

  if (input.provider === "google") {
    url.searchParams.set("prompt", "select_account");
  }

  // Requesting `name`/`email` from Apple makes form_post mandatory: Apple
  // refuses the authorize request otherwise, because it will not put a user's
  // name in a URL. The callback therefore arrives as a cross-site POST.
  if (input.provider === "apple") {
    url.searchParams.set("response_mode", "form_post");
  }

  return url;
}

async function fetchJson(input: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new SocialProviderError("provider_response_invalid");
  }
  return response.json();
}

function normalizeVerifiedEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!emailSchema.safeParse(email).success) {
    throw new SocialProviderError("verified_email_required");
  }
  return email;
}

async function exchangeGitHubProfile(
  code: string,
  config: SocialProviderConfig,
): Promise<SocialProfile> {
  const tokenResult = githubTokenSchema.safeParse(
    await fetchJson(config.tokenEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: await config.resolveClientSecret(),
        code,
        redirect_uri: getSocialCallbackUrl("github"),
      }),
    }),
  );
  if (!tokenResult.success) {
    throw new SocialProviderError("provider_response_invalid");
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${tokenResult.data.access_token}`,
    "User-Agent": "rxlab-auth",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const [userResult, emailsResult] = await Promise.all([
    fetchJson(config.userEndpoint, { headers }),
    fetchJson(config.emailsEndpoint!, { headers }),
  ]);
  const user = githubUserSchema.safeParse(userResult);
  const emails = githubEmailsSchema.safeParse(emailsResult);
  if (!user.success || !emails.success) {
    throw new SocialProviderError("provider_response_invalid");
  }

  const verifiedEmail =
    emails.data.find((entry) => entry.primary && entry.verified) ||
    emails.data.find((entry) => entry.verified);
  if (!verifiedEmail) {
    throw new SocialProviderError("verified_email_required");
  }

  return {
    provider: "github",
    providerAccountId: String(user.data.id),
    email: normalizeVerifiedEmail(verifiedEmail.email),
    name: user.data.name?.trim() || user.data.login,
    avatarUrl: user.data.avatar_url || null,
  };
}

async function exchangeGoogleProfile(
  code: string,
  config: SocialProviderConfig,
): Promise<SocialProfile> {
  const tokenResult = googleTokenSchema.safeParse(
    await fetchJson(config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: await config.resolveClientSecret(),
        code,
        grant_type: "authorization_code",
        redirect_uri: getSocialCallbackUrl("google"),
      }),
    }),
  );
  if (!tokenResult.success) {
    throw new SocialProviderError("provider_response_invalid");
  }

  const user = googleUserSchema.safeParse(
    await fetchJson(config.userEndpoint, {
      headers: { Authorization: `Bearer ${tokenResult.data.access_token}` },
    }),
  );
  if (!user.success) {
    throw new SocialProviderError("provider_response_invalid");
  }
  if (!user.data.email_verified) {
    throw new SocialProviderError("verified_email_required");
  }

  return {
    provider: "google",
    providerAccountId: user.data.sub,
    email: normalizeVerifiedEmail(user.data.email),
    name: user.data.name?.trim() || null,
    avatarUrl: user.data.picture || null,
  };
}

/**
 * Turn Apple's authorization code into a profile.
 *
 * Unlike the other two providers there is no second call for the user record:
 * the token response carries an `id_token` whose verified claims *are* the
 * profile. The display name never appears there — Apple sends it exactly once,
 * in a separate `user` form field on the first consent — so `appleUser` is the
 * only chance to capture it.
 */
async function exchangeAppleProfile(
  code: string,
  config: SocialProviderConfig,
  appleUser?: AppleUserPayload | null,
): Promise<SocialProfile> {
  const tokenResult = appleTokenSchema.safeParse(
    await fetchJson(config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: await config.resolveClientSecret(),
        code,
        grant_type: "authorization_code",
        redirect_uri: getSocialCallbackUrl("apple"),
      }),
    }),
  );
  if (!tokenResult.success) {
    throw new SocialProviderError("provider_response_invalid");
  }

  let claims;
  try {
    claims = await verifyAppleIdentityToken({
      identityToken: tokenResult.data.id_token,
      audiences: [config.clientId],
    });
  } catch {
    throw new SocialProviderError("provider_response_invalid");
  }

  return appleProfileFromClaims(claims, appleUser);
}

/**
 * Shared mapping from verified Apple claims to our profile shape, used by both
 * the browser flow and the native (ASAuthorizationAppleIDProvider) endpoint.
 *
 * Note that a private-relay address (`…@privaterelay.appleid.com`) is treated
 * like any other verified address: Apple guarantees delivery to it, and it is
 * stable per user per app, which is exactly what we need to key an account on.
 */
export function appleProfileFromClaims(
  claims: { sub: string; email?: string; email_verified?: boolean },
  appleUser?: AppleUserPayload | null,
): SocialProfile {
  // Apple omits `email` when the user previously revoked the app's access and
  // re-authorized without re-granting it. We can't create an account without
  // one, so surface the same error the other providers use.
  if (!claims.email || claims.email_verified === false) {
    throw new SocialProviderError("verified_email_required");
  }

  return {
    provider: "apple",
    providerAccountId: claims.sub,
    email: normalizeVerifiedEmail(claims.email),
    name: appleDisplayName(appleUser?.name),
    // Apple never provides a profile picture.
    avatarUrl: null,
  };
}

export async function exchangeSocialProfile(input: {
  provider: SocialProviderId;
  code: string;
  /** Apple only: the first-consent `user` payload carrying the display name. */
  appleUser?: AppleUserPayload | null;
}): Promise<SocialProfile> {
  const config = getSocialProvider(input.provider);
  if (!config) throw new SocialProviderError("provider_unavailable");

  switch (input.provider) {
    case "github":
      return exchangeGitHubProfile(input.code, config);
    case "google":
      return exchangeGoogleProfile(input.code, config);
    case "apple":
      return exchangeAppleProfile(input.code, config, input.appleUser);
  }
}
