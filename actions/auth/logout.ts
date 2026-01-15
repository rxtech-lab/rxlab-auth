"use server";

import { destroySession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
