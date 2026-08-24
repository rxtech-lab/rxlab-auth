import { z } from "zod";
import { emailSchema } from "@/lib/validations/auth";

export const SOCIAL_PROVIDER_IDS = ["github", "google"] as const;

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
  clientSecret: string;
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
  Omit<SocialProviderConfig, "clientId" | "clientSecret">
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

export function isSocialProviderId(value: string): value is SocialProviderId {
  return SOCIAL_PROVIDER_IDS.includes(value as SocialProviderId);
}

export function getSocialProvider(
  provider: SocialProviderId,
): SocialProviderConfig | null {
  const credentials =
    provider === "github"
      ? {
          clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
          clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        }
      : {
          clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        };

  if (!credentials.clientId || !credentials.clientSecret) return null;

  const config: SocialProviderConfig = {
    ...PROVIDER_METADATA[provider],
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
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

  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", getSocialCallbackUrl(input.provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", input.state);

  if (input.provider === "google") {
    url.searchParams.set("prompt", "select_account");
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
        client_secret: config.clientSecret,
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
        client_secret: config.clientSecret,
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

export async function exchangeSocialProfile(input: {
  provider: SocialProviderId;
  code: string;
}): Promise<SocialProfile> {
  const config = getSocialProvider(input.provider);
  if (!config) throw new SocialProviderError("provider_unavailable");

  return input.provider === "github"
    ? exchangeGitHubProfile(input.code, config)
    : exchangeGoogleProfile(input.code, config);
}
