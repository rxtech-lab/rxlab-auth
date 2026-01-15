"use server";

import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export interface DeleteClientResult {
  success: boolean;
  error?: string;
}

export async function deleteOAuthClient(clientId: string): Promise<DeleteClientResult> {
  try {
    await requireAdmin();

    await db.delete(oauthClients).where(eq(oauthClients.id, clientId));

    return { success: true };
  } catch (error) {
    console.error("Delete client error:", error);
    return {
      success: false,
      error: "Failed to delete client",
    };
  }
}

export async function deleteOAuthClientAndRedirect(clientId: string): Promise<void> {
  const result = await deleteOAuthClient(clientId);

  if (result.success) {
    redirect("/admin/dashboard/clients");
  }

  throw new Error(result.error);
}
