import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData, AdminSessionData } from "@/lib/auth/session";

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "rxlab-auth-session",
};

const adminSessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "rxlab-admin-session",
};

// Routes that require authentication
const protectedRoutes = ["/account"];

// Routes that require admin authentication
const adminRoutes = ["/admin/dashboard"];

// Routes that should redirect to account if already logged in
const authRoutes = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Security headers
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Check if route requires authentication
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname === route);

  if (isProtectedRoute) {
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    if (!session.isLoggedIn || !session.userId) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isAdminRoute) {
    const adminSession = await getIronSession<AdminSessionData>(
      request,
      response,
      adminSessionOptions
    );

    if (!adminSession.isAdmin) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  if (isAuthRoute) {
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions
    );

    if (session.isLoggedIn && session.userId) {
      return NextResponse.redirect(new URL("/account", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .well-known (OIDC discovery)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.well-known).*)",
  ],
};
