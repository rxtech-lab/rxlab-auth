"use server";

import { destroyAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export async function adminLogout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin");
}
