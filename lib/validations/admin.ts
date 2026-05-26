import { z } from "zod";
import { SUPPORTED_SCOPES } from "./oauth";

const redirectUriSchema = z
  .string()
  .min(1, "Redirect URI cannot be empty")
  .refine(
    (val) => {
      let testVal = val;
      if (testVal.includes("*")) {
        // Replace wildcard in port position with numeric placeholder first,
        // then replace remaining wildcards with string placeholder.
        testVal = testVal.replace(/:(\*)/g, ":1234");
        testVal = testVal.replace(/\*/g, "WILDCARD_PLACEHOLDER");
      }
      try {
        new URL(testVal);
        return true;
      } catch {
        return false;
      }
    },
    {
      message:
        "Must be a valid URL or URL pattern with * wildcards (e.g. https://*.example.com/callback)",
    }
  );

export const adminLoginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const createOAuthClientSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(64, "Name must be less than 64 characters"),
  description: z
    .string()
    .max(256, "Description must be less than 256 characters")
    .optional(),
  redirectUris: z
    .array(redirectUriSchema)
    .min(1, "At least one redirect URI is required"),
  allowedScopes: z
    .array(z.enum(SUPPORTED_SCOPES))
    .min(1, "At least one scope is required"),
  isFirstParty: z.boolean().optional().default(false),
  clientType: z.enum(["public", "confidential"]).default("confidential"),
  signInPermission: z.enum(["all", "none", "whitelist"]).default("all"),
});

export const updateOAuthClientSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(64, "Name must be less than 64 characters")
    .optional(),
  description: z
    .string()
    .max(256, "Description must be less than 256 characters")
    .optional()
    .nullable(),
  redirectUris: z
    .array(redirectUriSchema)
    .min(1, "At least one redirect URI is required")
    .optional(),
  allowedScopes: z
    .array(z.enum(SUPPORTED_SCOPES))
    .min(1, "At least one scope is required")
    .optional(),
  isFirstParty: z.boolean().optional(),
  signInPermission: z.enum(["all", "none", "whitelist"]).optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type CreateOAuthClientInput = z.infer<typeof createOAuthClientSchema>;
export type UpdateOAuthClientInput = z.infer<typeof updateOAuthClientSchema>;

// Sign-up settings schemas
export const updateSignUpSettingsSchema = z.object({
  signUpEnabled: z.boolean(),
  signUpWhitelistEnabled: z.boolean(),
});

export const addWhitelistEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const addClientWhitelistEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  clientId: z.string().min(1, "Client ID is required"),
});

// Apple app identifier: <TEAMID>.<BUNDLEID>
// - TEAMID: 10-char uppercase alphanumeric Apple Developer Team ID
// - BUNDLEID: reverse-DNS bundle id (letters, digits, dots, dashes)
const appleAppIdRegex = /^[A-Z0-9]{10}\.[A-Za-z0-9][A-Za-z0-9.\-]*$/;

export const addClientAppIdSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  appId: z
    .string()
    .min(1, "App ID is required")
    .max(255, "App ID is too long")
    .regex(
      appleAppIdRegex,
      "Must be in the form <TEAMID>.<BUNDLEID> (e.g. ABCDE12345.com.example.app)"
    ),
});

export type UpdateSignUpSettingsInput = z.infer<
  typeof updateSignUpSettingsSchema
>;
export type AddWhitelistEmailInput = z.infer<typeof addWhitelistEmailSchema>;
export type AddClientWhitelistEmailInput = z.infer<
  typeof addClientWhitelistEmailSchema
>;
export type AddClientAppIdInput = z.infer<typeof addClientAppIdSchema>;

// User management schemas
export const createUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().optional(),
  username: z
    .string()
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    )
    .optional()
    .nullable(),
  emailVerified: z.boolean().default(false),
});

export const updateUserSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .nullable(),
  displayName: z.string().optional().nullable(),
  username: z
    .string()
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    )
    .optional()
    .nullable(),
  emailVerified: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
