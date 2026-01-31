"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface ToggleVerifiedResult {
  success: boolean;
  error?: string;
  emailVerified?: boolean;
}

export async function toggleUserVerified(
  userId: string
): Promise<ToggleVerifiedResult> {
  try {
    await requireAdmin();

    if (!userId) {
      return {
        success: false,
        error: "User ID is required",
      };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    const newVerifiedStatus = !user.emailVerified;

    await db
      .update(users)
      .set({
        emailVerified: newVerifiedStatus,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    revalidatePath("/admin/dashboard/users");

    return {
      success: true,
      emailVerified: newVerifiedStatus,
    };
  } catch (error) {
    console.error("Toggle verified error:", error);
    return {
      success: false,
      error: "Failed to update verification status",
    };
  }
}
