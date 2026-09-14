import { importPKCS8, SignJWT } from "jose";

// Apple doesn't hand out a static client secret like GitHub or Google. The
// "secret" is an ES256 JWT we mint ourselves from a .p8 signing key downloaded
// from the Apple Developer portal, and it's only valid for as long as we say
// (Apple caps it at 6 months). We mint short-lived ones and cache them in
// module scope so a burst of sign-ins doesn't re-import the key each time.
//
// See: https://developer.apple.com/documentation/signinwithapplerestapi/generate_and_validate_tokens

export const APPLE_ISSUER = "https://appleid.apple.com";

const SECRET_TTL_SECONDS = 60 * 60; // 1 hour — well under Apple's 6-month cap.
// Re-mint slightly before expiry so an in-flight request can't race the clock.
const REFRESH_MARGIN_SECONDS = 60;

export class AppleClientSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleClientSecretError";
  }
}

export interface AppleSigningCredentials {
  teamId: string;
  keyId: string;
  privateKey: string;
  /** `sub` of the secret: the Services ID (web) or App ID (native). */
  clientId: string;
}

/**
 * Read the Apple signing credentials from the environment, or null when the
 * deployment hasn't configured Sign in with Apple. Mirrors the "both halves of
 * the credential pair or nothing" rule the other providers use, so a partially
 * configured Apple never shows up in the UI schema.
 */
export function getAppleSigningCredentials(): AppleSigningCredentials | null {
  const teamId = process.env.APPLE_OAUTH_TEAM_ID;
  const keyId = process.env.APPLE_OAUTH_KEY_ID;
  const privateKey = process.env.APPLE_OAUTH_PRIVATE_KEY;
  const clientId = process.env.APPLE_OAUTH_SERVICES_ID;

  if (!teamId || !keyId || !privateKey || !clientId) return null;
  return { teamId, keyId, privateKey, clientId };
}

/**
 * The bundle/app IDs allowed as the `aud` of a *native* Apple identity token.
 * The browser flow is audienced to the Services ID; an iOS or macOS app signing
 * in through `ASAuthorizationAppleIDProvider` gets tokens audienced to its
 * bundle identifier instead, so both have to be accepted.
 */
export function getAppleNativeAudiences(): string[] {
  return (process.env.APPLE_OAUTH_BUNDLE_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Recover the PKCS#8 PEM from whatever shape the key arrived in.
 *
 * A `.p8` is a multi-line file, and env vars are a single line, so every
 * deployment target mangles it differently. Three forms are accepted:
 *
 *   1. **Base64** of the whole `.p8` file (`base64 -i AuthKey_XXX.p8`) — the
 *      recommended form, because it is a single opaque token with no newlines,
 *      quotes, or escapes for a shell or dashboard to mangle.
 *   2. A real multi-line PEM (works in a `.env` file with quotes).
 *   3. A PEM flattened with literal `\n` escapes, which is how Vercel and most
 *      dashboards round-trip a multi-line secret.
 *
 * `importPKCS8` accepts only form 2, so 1 and 3 are converted here.
 */
export function decodeApplePrivateKey(value: string): string {
  const trimmed = value.trim();

  // Already armored: only the escaped-newline case needs fixing.
  if (trimmed.includes("-----BEGIN")) {
    return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(trimmed, "base64").toString("utf8");
  } catch {
    throw new AppleClientSecretError(
      "APPLE_OAUTH_PRIVATE_KEY is neither a PEM nor valid base64",
    );
  }

  // Guard against a value that merely *looks* like base64: Buffer.from is
  // lenient and will happily return mojibake rather than throwing.
  if (!decoded.includes("-----BEGIN")) {
    throw new AppleClientSecretError(
      "APPLE_OAUTH_PRIVATE_KEY did not decode to a PEM private key",
    );
  }

  return decoded.trim();
}

interface CachedSecret {
  token: string;
  expiresAt: number;
  fingerprint: string;
}

let cached: CachedSecret | null = null;

function fingerprint(credentials: AppleSigningCredentials): string {
  // Cheap identity for the credential set — enough to invalidate the cache when
  // env vars are rotated or swapped between tests, without hashing the key.
  return `${credentials.teamId}:${credentials.keyId}:${credentials.clientId}:${credentials.privateKey.length}`;
}

/**
 * Mint (or reuse) the ES256 client secret Apple's token endpoint expects.
 *
 * @param clientId Overrides the `sub` claim. Pass a bundle identifier when
 *   exchanging an authorization code that originated from a native app; the
 *   secret's `sub` has to match the `client_id` sent alongside it.
 */
export async function createAppleClientSecret(
  clientId?: string,
): Promise<string> {
  const credentials = getAppleSigningCredentials();
  if (!credentials) {
    throw new AppleClientSecretError("Apple signing credentials are not configured");
  }

  const subject = clientId || credentials.clientId;
  const key = fingerprint({ ...credentials, clientId: subject });
  const now = Math.floor(Date.now() / 1000);

  if (
    cached &&
    cached.fingerprint === key &&
    cached.expiresAt - REFRESH_MARGIN_SECONDS > now
  ) {
    return cached.token;
  }

  let privateKey;
  try {
    privateKey = await importPKCS8(
      decodeApplePrivateKey(credentials.privateKey),
      "ES256",
    );
  } catch (error) {
    // Keep the decoder's specific message ("not base64", "didn't decode to a
    // PEM"); only a genuine import failure gets the generic one.
    if (error instanceof AppleClientSecretError) throw error;
    throw new AppleClientSecretError(
      "APPLE_OAUTH_PRIVATE_KEY is not a valid PKCS#8 ES256 key",
    );
  }

  const expiresAt = now + SECRET_TTL_SECONDS;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: credentials.keyId })
    .setIssuer(credentials.teamId)
    .setSubject(subject)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  cached = { token, expiresAt, fingerprint: key };
  return token;
}

/** Test seam: drop the memoized secret so a test can swap credentials. */
export function resetAppleClientSecretCache(): void {
  cached = null;
}
