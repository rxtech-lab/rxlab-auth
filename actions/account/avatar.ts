"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { uploadImage, deleteImage } from "@/lib/blob";
import { eq } from "drizzle-orm";

export interface UploadAvatarResult {
  success: boolean;
  error?: string;
  avatarUrl?: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadAvatar(
  formData: FormData
): Promise<UploadAvatarResult> {
  try {
    const session = await requireAuth();

    const file = formData.get("avatar") as File | null;
    if (!file || !(file instanceof File)) {
      return {
        success: false,
        error: "No file provided",
      };
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: "Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.",
      };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: "File is too large. Maximum size is 2MB.",
      };
    }

    // Get current user to check for existing avatar
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId!),
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Delete old avatar if exists
    if (user.avatarUrl) {
      try {
        await deleteImage(user.avatarUrl);
      } catch {
        // Ignore deletion errors for old avatar
      }
    }

    // Upload new avatar
    const result = await uploadImage(file, "avatars");

    // Update user record
    await db
      .update(users)
      .set({
        avatarUrl: result.url,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId!));

    return { success: true, avatarUrl: result.url };
  } catch (error) {
    console.error("Upload avatar error:", error);
    return {
      success: false,
      error: "Failed to upload avatar",
    };
  }
}

export async function removeAvatar(): Promise<UploadAvatarResult> {
  try {
    const session = await requireAuth();

    // Get current user
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId!),
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Delete avatar from blob storage if exists
    if (user.avatarUrl) {
      try {
        await deleteImage(user.avatarUrl);
      } catch {
        // Ignore deletion errors
      }
    }

    // Clear avatar URL from user record
    await db
      .update(users)
      .set({
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId!));

    return { success: true };
  } catch (error) {
    console.error("Remove avatar error:", error);
    return {
      success: false,
      error: "Failed to remove avatar",
    };
  }
}
