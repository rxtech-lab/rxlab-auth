import { z } from "zod";
import { SUPPORTED_SCOPES } from "./oauth";

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
    .array(z.string().url("Each redirect URI must be a valid URL"))
    .min(1, "At least one redirect URI is required"),
  allowedScopes: z
    .array(z.enum(SUPPORTED_SCOPES))
    .min(1, "At least one scope is required"),
  isFirstParty: z.boolean().optional().default(false),
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
    .array(z.string().url("Each redirect URI must be a valid URL"))
    .min(1, "At least one redirect URI is required")
    .optional(),
  allowedScopes: z
    .array(z.enum(SUPPORTED_SCOPES))
    .min(1, "At least one scope is required")
    .optional(),
  isFirstParty: z.boolean().optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type CreateOAuthClientInput = z.infer<typeof createOAuthClientSchema>;
export type UpdateOAuthClientInput = z.infer<typeof updateOAuthClientSchema>;
