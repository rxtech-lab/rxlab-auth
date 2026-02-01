"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { updateUserSchema, type UpdateUserInput } from "@/lib/validations/admin";
import { eq, and, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { User } from "@/lib/db/schema";

export interface UpdateUserResult {
  success: boolean;
  error?: string;
  user?: User;
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput
): Promise<UpdateUserResult> {
  try {
    await requireAdmin();

    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { email, password, displayName, username, emailVerified } =
      parsed.data;

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!existingUser) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Check if email is taken by another user (if changing email)
    if (email && email.toLowerCase() !== existingUser.email) {
      const emailTaken = await db.query.users.findFirst({
        where: and(
          eq(users.email, email.toLowerCase()),
          not(eq(users.id, userId))
        ),
      });

      if (emailTaken) {
        return {
          success: false,
          error: "This email is already in use by another user",
        };
      }
    }

    // Check if username is taken by another user (if changing username)
    if (username && username !== existingUser.username) {
      const usernameTaken = await db.query.users.findFirst({
        where: and(eq(users.username, username), not(eq(users.id, userId))),
      });

      if (usernameTaken) {
        return {
          success: false,
          error: "This username is already taken",
        };
      }
    }

    // Build update object
    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (email !== undefined) {
      updateData.email = email.toLowerCase();
    }

    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    if (displayName !== undefined) {
      updateData.displayName = displayName;
    }

    if (username !== undefined) {
      updateData.username = username;
    }

    if (emailVerified !== undefined) {
      updateData.emailVerified = emailVerified;
    }

    // Update user
    await db.update(users).set(updateData).where(eq(users.id, userId));

    // Fetch updated user
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    revalidatePath("/admin/dashboard/users");

    return { success: true, user: updatedUser };
  } catch (error) {
    console.error("Update user error:", error);
    return {
      success: false,
      error: "Failed to update user",
    };
  }
}
