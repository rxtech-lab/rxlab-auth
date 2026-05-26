"use server";

import { db } from "@/lib/db";
import { oauthClientAppIds } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  addClientAppIdSchema,
  type AddClientAppIdInput,
} from "@/lib/validations/admin";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { OAuthClientAppId } from "@/lib/db/schema";

export interface ClientAppIdResult {
  success: boolean;
  error?: string;
  id?: string;
}

export interface GetClientAppIdsResult {
  success: boolean;
  error?: string;
  data?: OAuthClientAppId[];
}

export async function getClientAppIds(
  clientId: string
): Promise<GetClientAppIdsResult> {
  try {
    await requireAdmin();

    const rows = await db.query.oauthClientAppIds.findMany({
      where: eq(oauthClientAppIds.clientId, clientId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    return { success: true, data: rows };
  } catch (error) {
    console.error("Get client app IDs error:", error);
    return { success: false, error: "Failed to get client app IDs" };
  }
}

export async function addClientAppId(
  input: AddClientAppIdInput
): Promise<ClientAppIdResult> {
  try {
    await requireAdmin();

    const parsed = addClientAppIdSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { clientId, appId } = parsed.data;

    const existing = await db.query.oauthClientAppIds.findFirst({
      where: and(
        eq(oauthClientAppIds.clientId, clientId),
        eq(oauthClientAppIds.appId, appId)
      ),
    });

    if (existing) {
      return {
        success: false,
        error: "App ID is already registered for this client",
      };
    }

    const id = crypto.randomUUID();
    await db.insert(oauthClientAppIds).values({
      id,
      clientId,
      appId,
      createdAt: new Date(),
    });

    revalidatePath(`/admin/dashboard/clients/${clientId}`);
    revalidatePath("/.well-known/apple-app-site-association");

    return { success: true, id };
  } catch (error) {
    console.error("Add client app ID error:", error);
    return { success: false, error: "Failed to add app ID" };
  }
}

export async function removeClientAppId(
  id: string,
  clientId: string
): Promise<ClientAppIdResult> {
  try {
    await requireAdmin();

    await db.delete(oauthClientAppIds).where(eq(oauthClientAppIds.id, id));

    revalidatePath(`/admin/dashboard/clients/${clientId}`);
    revalidatePath("/.well-known/apple-app-site-association");

    return { success: true };
  } catch (error) {
    console.error("Remove client app ID error:", error);
    return { success: false, error: "Failed to remove app ID" };
  }
}
