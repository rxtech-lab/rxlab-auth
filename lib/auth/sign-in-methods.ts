import {
  SOCIAL_PROVIDER_IDS,
  type SocialProviderDescriptor,
  type SocialProviderId,
} from "@/lib/auth/social/providers";

/**
 * Per-client control over which sign-in methods an app may offer.
 *
 * This narrows what a client can do; it never widens it. A provider still has to
 * be configured server-wide (its env credentials present — see
 * getEnabledSocialProviders) before a client can enable it, and
 * `signInPermission` still gates the client as a whole. This is the third,
 * finest filter: "this app may use passkeys and Apple, but not passwords".
 */

export const SIGN_IN_METHOD_IDS = ["password", "passkey"] as const;
export type SignInMethodId = (typeof SIGN_IN_METHOD_IDS)[number];

export interface ClientSignInMethods {
  password: boolean;
  passkey: boolean;
  social: Record<SocialProviderId, boolean>;
}

function allSocial(value: boolean): Record<SocialProviderId, boolean> {
  return Object.fromEntries(
    SOCIAL_PROVIDER_IDS.map((id) => [id, value]),
  ) as Record<SocialProviderId, boolean>;
}

export const DEFAULT_SIGN_IN_METHODS: ClientSignInMethods = {
  password: true,
  passkey: true,
  social: allSocial(true),
};

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Parse the stored JSON.
 *
 * Fails open at every step — NULL, malformed JSON, the wrong type, or a missing
 * key all yield "enabled". A corrupt config column must not be able to lock
 * every user out of an app, and a newly added provider must default to available
 * rather than silently disappearing from clients configured before it existed.
 */
export function parseSignInMethods(raw: string | null): ClientSignInMethods {
  if (!raw) return DEFAULT_SIGN_IN_METHODS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SIGN_IN_METHODS;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return DEFAULT_SIGN_IN_METHODS;
  }

  const record = parsed as Record<string, unknown>;
  const socialRaw =
    record.social && typeof record.social === "object" && !Array.isArray(record.social)
      ? (record.social as Record<string, unknown>)
      : {};

  return {
    password: asBoolean(record.password, true),
    passkey: asBoolean(record.passkey, true),
    social: Object.fromEntries(
      SOCIAL_PROVIDER_IDS.map((id) => [id, asBoolean(socialRaw[id], true)]),
    ) as Record<SocialProviderId, boolean>,
  };
}

export function serializeSignInMethods(methods: ClientSignInMethods): string {
  return JSON.stringify({
    password: methods.password,
    passkey: methods.passkey,
    social: Object.fromEntries(
      SOCIAL_PROVIDER_IDS.map((id) => [id, methods.social[id] !== false]),
    ),
  });
}

export function isSignInMethodEnabled(
  methods: ClientSignInMethods,
  method: SignInMethodId,
): boolean {
  return methods[method];
}

export function isSocialProviderEnabled(
  methods: ClientSignInMethods,
  provider: SocialProviderId,
): boolean {
  return methods.social[provider] !== false;
}

/** Intersect the server-wide configured providers with this client's allow-list. */
export function filterSocialProviders<T extends { id: SocialProviderId }>(
  providers: T[],
  methods: ClientSignInMethods,
): T[] {
  return providers.filter((provider) =>
    isSocialProviderEnabled(methods, provider.id),
  );
}

export type { SocialProviderDescriptor };
