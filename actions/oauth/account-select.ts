"use server";

import { destroySession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export async function switchAccount(
  oauthParams: Record<string, string>
): Promise<void> {
  await destroySession();

  const authorizeParams = new URLSearchParams(oauthParams);
  authorizeParams.set("fresh_login", "true");
  const loginParams = new URLSearchParams({
    redirect: `/api/oauth/authorize?${authorizeParams.toString()}`,
  });
  redirect(`/login?${loginParams.toString()}`);
}
