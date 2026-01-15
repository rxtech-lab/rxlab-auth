import { createHash } from "crypto";

/**
 * Verify PKCE code challenge
 * Uses SHA-256 to hash the code_verifier and compare with code_challenge
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  codeChallengeMethod: string
): boolean {
  if (codeChallengeMethod !== "S256") {
    // Only S256 is supported
    return false;
  }

  // Hash the code verifier using SHA-256
  const hash = createHash("sha256").update(codeVerifier).digest();

  // Convert to base64url
  const computedChallenge = hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return computedChallenge === codeChallenge;
}

/**
 * Generate a code verifier for testing purposes
 */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Generate code challenge from verifier for testing purposes
 */
export function generateCodeChallenge(codeVerifier: string): string {
  const hash = createHash("sha256").update(codeVerifier).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
