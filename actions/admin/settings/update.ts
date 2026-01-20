"use server";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  updateSignUpSettingsSchema,
  type UpdateSignUpSettingsInput,
} from "@/lib/validations/admin";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface UpdateSettingsResult {
  success: boolean;
  error?: string;
}

export async function updateSignUpSettings(
  input: UpdateSignUpSettingsInput
): Promise<UpdateSettingsResult> {
  try {
    await requireAdmin();

    const parsed = updateSignUpSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const { signUpEnabled, signUpWhitelistEnabled } = parsed.data;
    const now = new Date();

    // Upsert the settings (insert or update)
    const existing = await db.query.appSettings.findFirst({
      where: eq(appSettings.id, "global"),
    });

    if (existing) {
      await db
        .update(appSettings)
        .set({
          signUpEnabled,
          signUpWhitelistEnabled,
          updatedAt: now,
        })
        .where(eq(appSettings.id, "global"));
    } else {
      await db.insert(appSettings).values({
        id: "global",
        signUpEnabled,
        signUpWhitelistEnabled,
        updatedAt: now,
      });
    }

    revalidatePath("/admin/dashboard/settings");

    return { success: true };
  } catch (error) {
    console.error("Update settings error:", error);
    return {
      success: false,
      error: "Failed to update settings",
    };
  }
}
