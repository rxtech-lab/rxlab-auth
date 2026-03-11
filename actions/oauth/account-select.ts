"use server";

import { destroySession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export async function switchAccount(
  oauthParams: Record<string, string>
): Promise<void> {
  await destroySession();

  const searchParams = new URLSearchParams(oauthParams);
  searchParams.set("fresh_login", "true");
  const loginUrl = `/login?redirect=/api/oauth/authorize?${searchParams.toString()}`;
  redirect(loginUrl);
}
