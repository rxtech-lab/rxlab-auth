"use server";

import { db } from "@/lib/db";
import { adminPasskeys } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { passkeyNameSchema } from "@/lib/validations/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface AdminPasskeyResult {
  success: boolean;
  error?: string;
}

export async function renameAdminPasskey(
  passkeyId: string,
  name: string
): Promise<AdminPasskeyResult> {
  try {
    await requireAdmin();

    const parsed = passkeyNameSchema.safeParse(name);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid name",
      };
    }

    // Verify passkey exists
    const passkey = await db.query.adminPasskeys.findFirst({
      where: eq(adminPasskeys.id, passkeyId),
    });

    if (!passkey) {
      return {
        success: false,
        error: "Passkey not found",
      };
    }

    await db
      .update(adminPasskeys)
      .set({ name: parsed.data })
      .where(eq(adminPasskeys.id, passkeyId));

    revalidatePath("/admin/dashboard/passkeys");

    return { success: true };
  } catch (error) {
    console.error("Rename admin passkey error:", error);
    return {
      success: false,
      error: "Failed to rename passkey",
    };
  }
}

export async function deleteAdminPasskey(
  passkeyId: string
): Promise<AdminPasskeyResult> {
  try {
    await requireAdmin();

    // Verify passkey exists
    const passkey = await db.query.adminPasskeys.findFirst({
      where: eq(adminPasskeys.id, passkeyId),
    });

    if (!passkey) {
      return {
        success: false,
        error: "Passkey not found",
      };
    }

    // Check if this is the only passkey - admin can still use password so allow deletion
    // But warn if it's the last one
    const allPasskeys = await db.query.adminPasskeys.findMany();
    if (allPasskeys.length === 1) {
      // Allow deletion but they'll need to use password to sign in
      console.warn("Deleting the last admin passkey");
    }

    await db.delete(adminPasskeys).where(eq(adminPasskeys.id, passkeyId));

    revalidatePath("/admin/dashboard/passkeys");

    return { success: true };
  } catch (error) {
    console.error("Delete admin passkey error:", error);
    return {
      success: false,
      error: "Failed to delete passkey",
    };
  }
}
