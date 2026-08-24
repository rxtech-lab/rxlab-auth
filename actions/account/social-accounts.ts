"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { passkeys, socialAccounts, users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import {
  isSocialProviderId,
  type SocialProviderId,
} from "@/lib/auth/social/providers";

export interface DisconnectSocialAccountResult {
  success: boolean;
  error?: string;
}

export async function disconnectSocialAccount(
  provider: SocialProviderId,
): Promise<DisconnectSocialAccountResult> {
  try {
    if (!isSocialProviderId(provider)) {
      return { success: false, error: "Unknown social provider." };
    }

    const session = await requireAuth();
    const userId = session.userId!;
    const result = await db.transaction(async (tx) => {
      const [user, userPasskeys, userSocialAccounts, socialAccount] =
        await Promise.all([
          tx.query.users.findFirst({ where: eq(users.id, userId) }),
          tx.query.passkeys.findMany({
            where: eq(passkeys.userId, userId),
            columns: { id: true },
          }),
          tx.query.socialAccounts.findMany({
            where: eq(socialAccounts.userId, userId),
            columns: { id: true },
          }),
          tx.query.socialAccounts.findFirst({
            where: and(
              eq(socialAccounts.userId, userId),
              eq(socialAccounts.provider, provider),
            ),
          }),
        ]);

      if (!user || !socialAccount) {
        return {
          success: false,
          error: "Connected social account not found.",
        };
      }

      const hasAnotherSignInMethod =
        Boolean(user.passwordHash) ||
        userPasskeys.length > 0 ||
        userSocialAccounts.length > 1;
      if (!hasAnotherSignInMethod) {
        return {
          success: false,
          error:
            "Add a passkey before disconnecting your only sign-in method.",
        };
      }

      await tx
        .delete(socialAccounts)
        .where(
          and(
            eq(socialAccounts.id, socialAccount.id),
            eq(socialAccounts.userId, userId),
          ),
        );

      return { success: true };
    });

    if (result.success) revalidatePath("/account");
    return result;
  } catch (error) {
    console.error("Disconnect social account error:", error);
    return { success: false, error: "Failed to disconnect social account." };
  }
}
