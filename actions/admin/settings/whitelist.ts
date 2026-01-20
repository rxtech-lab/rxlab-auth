"use server";

import { db } from "@/lib/db";
import { emailWhitelist } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  addWhitelistEmailSchema,
  type AddWhitelistEmailInput,
} from "@/lib/validations/admin";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { EmailWhitelist } from "@/lib/db/schema";

export interface WhitelistResult {
  success: boolean;
  error?: string;
}

export interface GetWhitelistResult {
  success: boolean;
  error?: string;
  data?: EmailWhitelist[];
}

export async function getWhitelistedEmails(): Promise<GetWhitelistResult> {
  try {
    await requireAdmin();

    const emails = await db.query.emailWhitelist.findMany({
      orderBy: (emailWhitelist, { desc }) => [desc(emailWhitelist.createdAt)],
    });

    return {
      success: true,
      data: emails,
    };
  } catch (error) {
    console.error("Get whitelist error:", error);
    return {
      success: false,
      error: "Failed to get whitelist",
    };
  }
}

export async function addWhitelistEmail(
  input: AddWhitelistEmailInput
): Promise<WhitelistResult> {
  try {
    await requireAdmin();

    const parsed = addWhitelistEmailSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid input",
      };
    }

    const email = parsed.data.email.toLowerCase();

    // Check if already exists
    const existing = await db.query.emailWhitelist.findFirst({
      where: eq(emailWhitelist.email, email),
    });

    if (existing) {
      return {
        success: false,
        error: "Email is already whitelisted",
      };
    }

    await db.insert(emailWhitelist).values({
      id: crypto.randomUUID(),
      email,
      createdAt: new Date(),
    });

    revalidatePath("/admin/dashboard/settings");

    return { success: true };
  } catch (error) {
    console.error("Add whitelist error:", error);
    return {
      success: false,
      error: "Failed to add email to whitelist",
    };
  }
}

export async function removeWhitelistEmail(id: string): Promise<WhitelistResult> {
  try {
    await requireAdmin();

    await db.delete(emailWhitelist).where(eq(emailWhitelist.id, id));

    revalidatePath("/admin/dashboard/settings");

    return { success: true };
  } catch (error) {
    console.error("Remove whitelist error:", error);
    return {
      success: false,
      error: "Failed to remove email from whitelist",
    };
  }
}
