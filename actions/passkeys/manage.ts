"use server";

import { db } from "@/lib/db";
import { passkeys, socialAccounts, users } from "@/lib/db/schema";
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

    const [userPasskeys, userSocialAccounts, user] = await Promise.all([
      db.query.passkeys.findMany({
        where: eq(passkeys.userId, session.userId!),
      }),
      db.query.socialAccounts.findMany({
        where: eq(socialAccounts.userId, session.userId!),
        columns: { id: true },
      }),
      db.query.users.findFirst({
        where: eq(users.id, session.userId!),
      }),
    ]);

    if (
      userPasskeys.length === 1 &&
      !user?.passwordHash &&
      userSocialAccounts.length === 0
    ) {
      return {
        success: false,
        error:
          "Cannot delete your only sign-in method. Add another passkey or connect a social account first.",
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
