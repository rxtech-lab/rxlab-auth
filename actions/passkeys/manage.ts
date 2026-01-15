"use server";

import { db } from "@/lib/db";
import { passkeys } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { passkeyNameSchema } from "@/lib/validations/auth";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface PasskeyResult {
  success: boolean;
  error?: string;
}

export async function renamePasskey(
  passkeyId: string,
  name: string
): Promise<PasskeyResult> {
  try {
    const session = await requireAuth();

    const parsed = passkeyNameSchema.safeParse(name);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid name",
      };
    }

    // Verify passkey belongs to user
    const passkey = await db.query.passkeys.findFirst({
      where: and(
        eq(passkeys.id, passkeyId),
        eq(passkeys.userId, session.userId!)
      ),
    });

    if (!passkey) {
      return {
        success: false,
        error: "Passkey not found",
      };
    }

    await db
      .update(passkeys)
      .set({ name: parsed.data })
      .where(eq(passkeys.id, passkeyId));

    revalidatePath("/account/passkeys");

    return { success: true };
  } catch (error) {
    console.error("Rename passkey error:", error);
    return {
      success: false,
      error: "Failed to rename passkey",
    };
  }
}

export async function deletePasskey(passkeyId: string): Promise<PasskeyResult> {
  try {
    const session = await requireAuth();

    // Verify passkey belongs to user
    const passkey = await db.query.passkeys.findFirst({
      where: and(
        eq(passkeys.id, passkeyId),
        eq(passkeys.userId, session.userId!)
      ),
    });

    if (!passkey) {
      return {
        success: false,
        error: "Passkey not found",
      };
    }

    // Check if this is the only passkey and user has no password
    const userPasskeys = await db.query.passkeys.findMany({
      where: eq(passkeys.userId, session.userId!),
    });

    // Get user to check if they have a password
    const { users } = await import("@/lib/db/schema");
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId!),
    });

    if (userPasskeys.length === 1 && !user?.passwordHash) {
      return {
        success: false,
        error: "Cannot delete your only passkey. Add a password first or keep at least one passkey.",
      };
    }

    await db.delete(passkeys).where(eq(passkeys.id, passkeyId));

    revalidatePath("/account/passkeys");

    return { success: true };
  } catch (error) {
    console.error("Delete passkey error:", error);
    return {
      success: false,
      error: "Failed to delete passkey",
    };
  }
}
