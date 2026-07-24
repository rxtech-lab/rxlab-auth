import { z } from "zod";
import { SUPPORTED_SCOPES, type SupportedScope, normalizeScope } from "@/lib/scopes";

export { SUPPORTED_SCOPES, type SupportedScope };

export const authorizeRequestSchema = z.object({
  client_id: z.string().min(1, "client_id is required"),
  redirect_uri: z.string().url("redirect_uri must be a valid URL"),
  response_type: z.literal("code"),
  scope: z.string().min(1, "scope is required"),
  state: z.string().optional(),
  code_challenge: z.string().min(1, "code_challenge is required (PKCE)"),
  code_challenge_method: z.literal("S256"),
  nonce: z.string().optional(),
});

export const tokenRequestSchema = z.discriminatedUnion("grant_type", [
  // Authorization code grant (public clients don't need client_secret)
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string().min(1, "code is required"),
    redirect_uri: z.string().url("redirect_uri must be a valid URL"),
    code_verifier: z.string().min(1, "code_verifier is required (PKCE)"),
    client_id: z.string().min(1, "client_id is required"),
    client_secret: z.string().optional(),
  }),
  // Refresh token grant (public clients don't need client_secret)
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string().min(1, "refresh_token is required"),
    client_id: z.string().min(1, "client_id is required"),
    client_secret: z.string().optional(),
    scope: z.string().optional(),
  }),
  // Client credentials grant (machine-to-machine) - client_secret validated in route
  z.object({
    grant_type: z.literal("client_credentials"),
    client_id: z.string().min(1, "client_id is required"),
    client_secret: z.string().min(1).optional(),
    scope: z.string().optional(),
  }),
  // Resource Owner Password Credentials grant (public clients don't need client_secret)
  z.object({
    grant_type: z.literal("password"),
    username: z.string().min(1, "username is required"),
    password: z.string().min(1, "password is required"),
    client_id: z.string().min(1, "client_id is required"),
    client_secret: z.string().optional(),
    scope: z.string().optional(),
  }),
]);

// Native sign-up request for first-party clients (POST /api/oauth/signup)
export const signupRequestSchema = z.object({
  client_id: z.string().min(1, "client_id is required"),
  username: z.string().email("username must be a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters"),
  name: z.string().min(1).max(64).optional(),
  scope: z.string().optional(),
});

export type SignupRequest = z.infer<typeof signupRequestSchema>;

// WebAuthn assertion JSON (sign-in). Kept loose; @simplewebauthn does the
// real structural validation against the stored challenge.
export const passkeyAssertionSchema = z
  .object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal("public-key"),
    response: z.object({
      clientDataJSON: z.string().min(1),
      authenticatorData: z.string().min(1),
      signature: z.string().min(1),
      userHandle: z.string().nullish(),
    }),
    clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
    authenticatorAttachment: z.string().optional(),
  })
  .passthrough();

// WebAuthn attestation JSON (registration).
export const passkeyAttestationSchema = z
  .object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    type: z.literal("public-key"),
    response: z.object({
      clientDataJSON: z.string().min(1),
      attestationObject: z.string().min(1),
      transports: z.array(z.string()).optional(),
      publicKeyAlgorithm: z.number().optional(),
      publicKey: z.string().optional(),
      authenticatorData: z.string().optional(),
    }),
    clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
    authenticatorAttachment: z.string().optional(),
  })
  .passthrough();

// POST /api/oauth/passkey/authenticate/options
export const passkeyAuthOptionsRequestSchema = z.object({
  client_id: z.string().min(1, "client_id is required"),
  redirect_uri: z.string().min(1, "redirect_uri is required"),
  username: z.string().email().optional(),
});

// POST /api/oauth/passkey/authenticate/verify
export const passkeyAuthVerifyRequestSchema = z.object({
  client_id: z.string().min(1, "client_id is required"),
  session_id: z.string().min(1, "session_id is required"),
  credential: passkeyAssertionSchema,
  scope: z.string().optional(),
});

// POST /api/oauth/passkey/register/options
export const passkeyRegisterOptionsRequestSchema = z.object({
  client_id: z.string().min(1, "client_id is required"),
  redirect_uri: z.string().min(1, "redirect_uri is required"),
  username: z.string().email("username must be a valid email address"),
  name: z.string().min(1).max(64).optional(),
});

// POST /api/oauth/passkey/register/verify
export const passkeyRegisterVerifyRequestSchema = z.object({
  client_id: z.string().min(1, "client_id is required"),
  session_id: z.string().min(1, "session_id is required"),
  credential: passkeyAttestationSchema,
  scope: z.string().optional(),
});

// POST /api/oauth/passkey/upgrade/options
// Bearer-token-authenticated. Body is optional; `name` lets the client label
// the new credential ("MacBook Pro", etc.).
export const passkeyUpgradeOptionsRequestSchema = z.object({
  name: z.string().min(1).max(64).optional(),
});

// POST /api/oauth/passkey/upgrade/verify
// Bearer-token-authenticated. The user is derived from the access token, so
// no client_id / scope are needed — this route does not issue OAuth tokens.
export const passkeyUpgradeVerifyRequestSchema = z.object({
  session_id: z.string().min(1, "session_id is required"),
  credential: passkeyAttestationSchema,
  name: z.string().min(1).max(64).optional(),
});

export type PasskeyUpgradeOptionsRequest = z.infer<
  typeof passkeyUpgradeOptionsRequestSchema
>;
export type PasskeyUpgradeVerifyRequest = z.infer<
  typeof passkeyUpgradeVerifyRequestSchema
>;

// POST /api/oauth/passkey/account-creation/options
// Pre-auth. iOS 26 / macOS 26 ASAuthorizationAccountCreationProvider — the
// OS sheet collects the contact identifier from iCloud at verify time, so
// no username/name is supplied here.
export const passkeyAccountCreationOptionsRequestSchema = z.object({
  client_id: z.string().min(1, "client_id is required"),
  redirect_uri: z.string().min(1, "redirect_uri is required"),
});

// POST /api/oauth/passkey/account-creation/verify
// `contact_identifier` is the email or phone returned by the OS sheet.
export const passkeyAccountCreationVerifyRequestSchema = z.object({
  client_id: z.string().min(1, "client_id is required"),
  session_id: z.string().min(1, "session_id is required"),
  credential: passkeyAttestationSchema,
  contact_identifier: z.string().min(1, "contact_identifier is required"),
  contact_identifier_type: z.enum(["email", "phone_number"]),
  name: z.string().min(1).max(64).optional(),
  scope: z.string().optional(),
});

export type PasskeyAccountCreationOptionsRequest = z.infer<
  typeof passkeyAccountCreationOptionsRequestSchema
>;
export type PasskeyAccountCreationVerifyRequest = z.infer<
  typeof passkeyAccountCreationVerifyRequestSchema
>;

export type PasskeyAuthOptionsRequest = z.infer<
  typeof passkeyAuthOptionsRequestSchema
>;
export type PasskeyAuthVerifyRequest = z.infer<
  typeof passkeyAuthVerifyRequestSchema
>;
export type PasskeyRegisterOptionsRequest = z.infer<
  typeof passkeyRegisterOptionsRequestSchema
>;
export type PasskeyRegisterVerifyRequest = z.infer<
  typeof passkeyRegisterVerifyRequestSchema
>;

export const revokeRequestSchema = z.object({
  token: z.string().min(1, "token is required"),
  token_type_hint: z.enum(["access_token", "refresh_token"]).optional(),
  client_id: z.string().min(1, "client_id is required"),
  client_secret: z.string().optional(),
});

export type AuthorizeRequest = z.infer<typeof authorizeRequestSchema>;
export type TokenRequest = z.infer<typeof tokenRequestSchema>;
export type RevokeRequest = z.infer<typeof revokeRequestSchema>;

// Helper to validate and parse scopes
export function parseScopes(scopeString: string): SupportedScope[] {
  const requestedScopes = scopeString.split(" ").filter(Boolean);
  const validScopes: SupportedScope[] = [];

  for (const requested of requestedScopes) {
    // Accept standard OIDC scope names (email/profile) by mapping them onto the
    // internal vocabulary (read:email/read:profile) before validating.
    const scope = normalizeScope(requested) as SupportedScope;
    if (
      SUPPORTED_SCOPES.includes(scope) &&
      !validScopes.includes(scope)
    ) {
      validScopes.push(scope);
    }
  }

  return validScopes;
}

// Check if requested scopes are valid
export function validateScopes(
  requestedScopes: string[],
  allowedScopes: string[]
): boolean {
  return requestedScopes.every((scope) => allowedScopes.includes(scope));
}
