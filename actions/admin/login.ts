"use server";

import { createAdminSession } from "@/lib/auth/session";
import { adminLoginSchema, type AdminLoginInput } from "@/lib/validations/admin";
import { redirect } from "next/navigation";

export interface AdminLoginResult {
  success: boolean;
  error?: string;
}

export async function adminLogin(input: AdminLoginInput): Promise<AdminLoginResult> {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const { password } = parsed.data;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return {
      success: false,
      error: "Admin password not configured",
    };
  }

  if (password !== adminPassword) {
    return {
      success: false,
      error: "Invalid password",
    };
  }

  await createAdminSession();

  return { success: true };
}

export async function adminLoginAndRedirect(input: AdminLoginInput): Promise<void> {
  const result = await adminLogin(input);

  if (result.success) {
    redirect("/admin/dashboard");
  }

  throw new Error(result.error);
}
