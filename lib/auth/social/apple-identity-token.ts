import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { APPLE_ISSUER } from "@/lib/auth/social/apple-client-secret";

// Apple has no userinfo endpoint. Everything we know about the user rides in
// the `id_token` returned from /auth/token (web) or handed to the app by
// ASAuthorizationAppleIDProvider (native), so verifying that JWT properly *is*
// the profile fetch — signature, issuer, audience, and expiry all matter.

const JWKS_URL = "https://appleid.apple.com/auth/keys";

// Apple is inconsistent about JSON types here: `email_verified` and
// `is_private_email` come back as real booleans in some responses and as the
// strings "true"/"false" in others. Coerce rather than trust either shape.
const looseBoolean = z
  .union([z.boolean(), z.literal("true"), z.literal("false")])
  .transform((value) => value === true || value === "true");

const appleIdentityClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1).optional(),
  email_verified: looseBoolean.optional(),
  is_private_email: looseBoolean.optional(),
  nonce: z.string().optional(),
  nonce_supported: z.boolean().optional(),
});

export type AppleIdentityClaims = z.infer<typeof appleIdentityClaimsSchema>;

export class AppleIdentityTokenError extends Error {
  constructor(
    public readonly code:
      | "invalid_token"
      | "invalid_audience"
      | "invalid_nonce"
      | "email_missing",
  ) {
    super(code);
    this.name = "AppleIdentityTokenError";
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksUrl: string | null = null;

/**
 * Apple's public keys, cached by `jose` (it handles rotation and re-fetching).
 *
 * In non-production runs with `SOCIAL_OAUTH_TEST_BASE_URL` set, we point at the
 * mock server's key set instead. The verification path stays identical — the
 * e2e server signs real ES256 tokens — so tests exercise the same code the
 * production flow does rather than a bypass branch.
 */
function getJwks() {
  const testBaseUrl = process.env.SOCIAL_OAUTH_TEST_BASE_URL;
  const url =
    testBaseUrl && process.env.NODE_ENV !== "production"
      ? `${testBaseUrl.replace(/\/$/, "")}/apple/keys`
      : JWKS_URL;

  if (!jwks || jwksUrl !== url) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksUrl = url;
  }
  return jwks;
}

/** Test seam: force the next verification to rebuild the remote key set. */
export function resetAppleJwksCache(): void {
  jwks = null;
  jwksUrl = null;
}

export interface VerifyAppleIdentityTokenInput {
  identityToken: string;
  /** Accepted `aud` values: the Services ID for web, bundle IDs for native. */
  audiences: string[];
  /**
   * The raw nonce the client generated. Apple echoes back whatever the client
   * put on the request; the convention (and what RxAuthSwift does) is to send
   * SHA-256(raw) to Apple and the raw value here, so we hash before comparing.
   */
  expectedNonce?: string;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAppleIdentityToken(
  input: VerifyAppleIdentityTokenInput,
): Promise<AppleIdentityClaims> {
  if (input.audiences.length === 0) {
    throw new AppleIdentityTokenError("invalid_audience");
  }

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(input.identityToken, getJwks(), {
      issuer: APPLE_ISSUER,
      audience: input.audiences,
      algorithms: ["RS256"],
    }));
  } catch {
    throw new AppleIdentityTokenError("invalid_token");
  }

  const claims = appleIdentityClaimsSchema.safeParse(payload);
  if (!claims.success) {
    throw new AppleIdentityTokenError("invalid_token");
  }

  if (input.expectedNonce !== undefined) {
    const expected = await sha256Hex(input.expectedNonce);
    // Apple omits `nonce` entirely when the client didn't send one; treating a
    // missing nonce as a match would defeat the replay protection.
    if (!claims.data.nonce || claims.data.nonce !== expected) {
      throw new AppleIdentityTokenError("invalid_nonce");
    }
  }

  return claims.data;
}

/**
 * Apple's first-authorization-only name payload. The user's name is handed over
 * exactly once — on the very first consent — and never again, so whichever flow
 * sees it has to persist it immediately.
 */
export const appleUserPayloadSchema = z.object({
  name: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .optional(),
  email: z.string().optional(),
});

export type AppleUserPayload = z.infer<typeof appleUserPayloadSchema>;

export function parseAppleUserPayload(raw: string | null): AppleUserPayload | null {
  if (!raw) return null;
  try {
    const parsed = appleUserPayloadSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Join Apple's split name parts into the single display name we store. */
export function appleDisplayName(
  parts: { firstName?: string; lastName?: string } | undefined,
): string | null {
  if (!parts) return null;
  const name = [parts.firstName, parts.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name || null;
}
