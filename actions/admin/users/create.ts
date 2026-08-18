"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { generateAvatarSeed } from "@/lib/identicon/generate";
import { createUserSchema, type CreateUserInput } from "@/lib/validations/admin";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { findMissingPermissionClientIds } from "@/lib/admin-api/permission-targets";

export interface CreateUserResult {
  success: boolean;
  error?: string;
  userId?: string;
}

export async function createUser(
  input: CreateUserInput
): Promise<CreateUserResult> {
  try {
    await requireAdmin();

    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const {
      email,
      password,
      displayName,
      username,
      emailVerified,
      adminApiPermissions,
    } = parsed.data;

    const missingClientIds = await findMissingPermissionClientIds(
      adminApiPermissions,
    );
    if (missingClientIds.length > 0) {
      return {
        success: false,
        error: `Unknown OAuth client: ${missingClientIds.join(", ")}`,
      };
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return {
        success: false,
        error: "A user with this email already exists",
      };
    }

    // Check if username is taken (if provided)
    if (username) {
      const existingUsername = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (existingUsername) {
        return {
          success: false,
          error: "This username is already taken",
        };
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate user ID and avatar seed
    const userId = crypto.randomUUID();
    const avatarSeed = generateAvatarSeed();
    const now = new Date();

    // Create user
    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || email.split("@")[0],
      username: username || null,
      avatarSeed,
      emailVerified,
      adminApiPermissions: JSON.stringify(adminApiPermissions),
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/admin/dashboard/users");

    return { success: true, userId };
  } catch (error) {
    console.error("Create user error:", error);
    return {
      success: false,
      error: "Failed to create user",
    };
  }
}
