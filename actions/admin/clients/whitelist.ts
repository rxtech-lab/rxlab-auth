"use server";

import { db } from "@/lib/db";
import { oauthClientEmailWhitelist } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  addClientWhitelistEmailSchema,
  type AddClientWhitelistEmailInput,
} from "@/lib/validations/admin";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { OAuthClientEmailWhitelist } from "@/lib/db/schema";

export interface ClientWhitelistResult {
  success: boolean;
  error?: string;
  id?: string;
}

export interface GetClientWhitelistResult {
  success: boolean;
  error?: string;
  data?: OAuthClientEmailWhitelist[];
}

export async function getClientWhitelistEmails(
  clientId: string
): Promise<GetClientWhitelistResult> {
  try {
    await requireAdmin();

    const emails = await db.query.oauthClientEmailWhitelist.findMany({
      where: eq(oauthClientEmailWhitelist.clientId, clientId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    return {
      success: true,
      data: emails,
    };
  } catch (error) {
    console.error("Get client whitelist error:", error);
    return {
      success: false,
      error: "Failed to get client whitelist",
    };
  }
}

export async function addClientWhitelistEmail(
  input: AddClientWhitelistEmailInput
): Promise<ClientWhitelistResult> {
  try {
    await requireAdmin();

    const parsed = addClientWhitelistEmailSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const email = parsed.data.email.toLowerCase();
    const clientId = parsed.data.clientId;

    // Check if already exists
    const existing = await db.query.oauthClientEmailWhitelist.findFirst({
      where: and(
        eq(oauthClientEmailWhitelist.clientId, clientId),
        eq(oauthClientEmailWhitelist.email, email)
      ),
    });

    if (existing) {
      return {
        success: false,
        error: "Email is already whitelisted for this client",
      };
    }

    const id = crypto.randomUUID();
    await db.insert(oauthClientEmailWhitelist).values({
      id,
      clientId,
      email,
      createdAt: new Date(),
    });

    revalidatePath(`/admin/dashboard/clients/${clientId}`);

    return { success: true, id };
  } catch (error) {
    console.error("Add client whitelist error:", error);
    return {
      success: false,
      error: "Failed to add email to client whitelist",
    };
  }
}

export async function removeClientWhitelistEmail(
  id: string,
  clientId: string
): Promise<ClientWhitelistResult> {
  try {
    await requireAdmin();

    await db
      .delete(oauthClientEmailWhitelist)
      .where(eq(oauthClientEmailWhitelist.id, id));

    revalidatePath(`/admin/dashboard/clients/${clientId}`);

    return { success: true };
  } catch (error) {
    console.error("Remove client whitelist error:", error);
    return {
      success: false,
      error: "Failed to remove email from client whitelist",
    };
  }
}
