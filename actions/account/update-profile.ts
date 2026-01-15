"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/auth";
import { eq, and, ne } from "drizzle-orm";

export interface UpdateProfileResult {
  success: boolean;
  error?: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  try {
    const session = await requireAuth();

    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { username, displayName } = parsed.data;

    // Check if username is taken (if provided)
    if (username) {
      const existingUser = await db.query.users.findFirst({
        where: and(
          eq(users.username, username),
          ne(users.id, session.userId!)
        ),
      });

      if (existingUser) {
        return {
          success: false,
          error: "Username is already taken",
        };
      }
    }

    // Update user
    await db
      .update(users)
      .set({
        username: username ?? null,
        displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId!));

    return { success: true };
  } catch (error) {
    console.error("Update profile error:", error);
    return {
      success: false,
      error: "Failed to update profile",
    };
  }
}
