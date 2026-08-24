import { NextResponse } from "next/server";
import { getOAuthIssuerUrl } from "@/lib/auth/social/providers";
import { sanitizeRedirectPath } from "@/lib/auth/social/state";
import type { SocialSigninErrorCode } from "@/lib/auth/social/errors";

export function socialSigninErrorRedirect(input: {
  code: SocialSigninErrorCode;
  redirectTo?: string;
}): NextResponse {
  const url = new URL("/login", getOAuthIssuerUrl());
  url.searchParams.set("error", input.code);
  const redirectTo = sanitizeRedirectPath(input.redirectTo);
  if (redirectTo !== "/account") {
    url.searchParams.set("redirect", redirectTo);
  }
  return NextResponse.redirect(url);
}
