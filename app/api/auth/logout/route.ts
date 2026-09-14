import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

/**
 * Clear the session cookie and bounce to /login.
 *
 * Exists to break a redirect loop: a session cookie is stateless, so it stays
 * valid after the user row it points at is gone (a scheduled deletion firing, or
 * an admin deleting the account mid-session). When that happens the account
 * layout redirects to /login, proxy.ts sees a still-"logged in" cookie on an
 * auth route and redirects straight back to /account, and the browser gives up
 * with ERR_TOO_MANY_REDIRECTS.
 *
 * Cookies can only be mutated in a Route Handler or Server Action — not during a
 * layout render — which is why this is a route rather than an inline fix in the
 * layout. `/api` is excluded from the proxy matcher, so nothing intercepts it.
 */
export async function GET(request: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}
