"use server";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

export interface GetSettingsResult {
  success: boolean;
  error?: string;
  data?: {
    signUpEnabled: boolean;
    signUpWhitelistEnabled: boolean;
  };
}

export async function getSignUpSettings(): Promise<GetSettingsResult> {
  try {
    await requireAdmin();

    const settings = await db.query.appSettings.findFirst({
      where: eq(appSettings.id, "global"),
    });

    // Return defaults if no settings exist
    return {
      success: true,
      data: {
        signUpEnabled: settings?.signUpEnabled ?? true,
        signUpWhitelistEnabled: settings?.signUpWhitelistEnabled ?? false,
      },
    };
  } catch (error) {
    console.error("Get settings error:", error);
    return {
      success: false,
      error: "Failed to get settings",
    };
  }
}
