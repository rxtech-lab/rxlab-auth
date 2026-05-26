import { z } from "zod";
import { SUPPORTED_SCOPES, type SupportedScope } from "@/lib/scopes";

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

  for (const scope of requestedScopes) {
    if (SUPPORTED_SCOPES.includes(scope as SupportedScope)) {
      validScopes.push(scope as SupportedScope);
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
