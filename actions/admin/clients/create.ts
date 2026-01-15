"use server";

import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { createOAuthClientSchema, type CreateOAuthClientInput } from "@/lib/validations/admin";
import { redirect } from "next/navigation";

export interface CreateClientResult {
  success: boolean;
  error?: string;
  clientId?: string;
  clientSecret?: string;
}

export async function createOAuthClient(
  input: CreateOAuthClientInput
): Promise<CreateClientResult> {
  try {
    await requireAdmin();

    const parsed = createOAuthClientSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { name, description, redirectUris, allowedScopes, isFirstParty } = parsed.data;

    // Generate client credentials
    const clientId = `client_${crypto.randomUUID().replace(/-/g, "")}`;
    const clientSecret = `secret_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;

    // Hash the secret
    const hashedSecret = await hashPassword(clientSecret);

    const now = new Date();

    await db.insert(oauthClients).values({
      id: clientId,
      secret: hashedSecret,
      name,
      description: description || null,
      redirectUris: JSON.stringify(redirectUris),
      allowedScopes: JSON.stringify(allowedScopes),
      isFirstParty: isFirstParty || false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      clientId,
      clientSecret, // Return unhashed for display once
    };
  } catch (error) {
    console.error("Create client error:", error);
    return {
      success: false,
      error: "Failed to create client",
    };
  }
}
