"use server";

import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { updateOAuthClientSchema, type UpdateOAuthClientInput } from "@/lib/validations/admin";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface UpdateClientResult {
  success: boolean;
  error?: string;
  newSecret?: string;
}

export async function updateOAuthClient(
  clientId: string,
  input: UpdateOAuthClientInput
): Promise<UpdateClientResult> {
  try {
    await requireAdmin();

    const parsed = updateOAuthClientSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { name, description, redirectUris, allowedScopes, isFirstParty, signInPermission } = parsed.data;

    const updateData: Partial<typeof oauthClients.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (redirectUris !== undefined)
      updateData.redirectUris = JSON.stringify(redirectUris);
    if (allowedScopes !== undefined)
      updateData.allowedScopes = JSON.stringify(allowedScopes);
    if (isFirstParty !== undefined) updateData.isFirstParty = isFirstParty;
    if (signInPermission !== undefined)
      updateData.signInPermission = signInPermission;

    await db
      .update(oauthClients)
      .set(updateData)
      .where(eq(oauthClients.id, clientId));

    revalidatePath("/admin/dashboard/clients");
    revalidatePath(`/admin/dashboard/clients/${clientId}`);

    return { success: true };
  } catch (error) {
    console.error("Update client error:", error);
    return {
      success: false,
      error: "Failed to update client",
    };
  }
}

export async function regenerateClientSecret(
  clientId: string
): Promise<UpdateClientResult> {
  try {
    await requireAdmin();

    const newSecret = `secret_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
    const hashedSecret = await hashPassword(newSecret);

    await db
      .update(oauthClients)
      .set({
        secret: hashedSecret,
        updatedAt: new Date(),
      })
      .where(eq(oauthClients.id, clientId));

    return {
      success: true,
      newSecret,
    };
  } catch (error) {
    console.error("Regenerate secret error:", error);
    return {
      success: false,
      error: "Failed to regenerate secret",
    };
  }
}

export async function updateClientIcon(
  clientId: string,
  iconUrl: string | null
): Promise<UpdateClientResult> {
  try {
    await requireAdmin();

    await db
      .update(oauthClients)
      .set({
        iconUrl,
        updatedAt: new Date(),
      })
      .where(eq(oauthClients.id, clientId));

    revalidatePath("/admin/dashboard/clients");
    revalidatePath(`/admin/dashboard/clients/${clientId}`);

    return { success: true };
  } catch (error) {
    console.error("Update icon error:", error);
    return {
      success: false,
      error: "Failed to update icon",
    };
  }
}
