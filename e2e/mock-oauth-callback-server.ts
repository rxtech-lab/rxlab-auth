/**
 * Mock OAuth client callback and social identity-provider server for E2E tests.
 */

interface MockSocialProfile {
  accountId: string;
  email: string;
  name: string;
}

const DEFAULT_SOCIAL_PROFILE: MockSocialProfile = {
  accountId: "e2e-social-account",
  email: "social-e2e@example.com",
  name: "Social E2E User",
};

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") || "";
  for (const cookie of header.split(";")) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

function decodeProfile(value: string | null | undefined): MockSocialProfile {
  if (!value) return DEFAULT_SOCIAL_PROFILE;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<MockSocialProfile>;
    if (parsed.accountId && parsed.email && parsed.name) {
      return {
        accountId: parsed.accountId,
        email: parsed.email,
        name: parsed.name,
      };
    }
  } catch {
    // Fall through to the deterministic default profile.
  }

  return DEFAULT_SOCIAL_PROFILE;
}

function bearerProfile(request: Request): MockSocialProfile {
  const authorization = request.headers.get("authorization") || "";
  return decodeProfile(authorization.replace(/^Bearer\s+/i, ""));
}

const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/callback") {
      const params = Object.fromEntries(url.searchParams.entries());

      // Return an HTML page showing the callback parameters
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Callback</title>
</head>
<body>
  <h1>OAuth Callback Received</h1>
  <pre>${JSON.stringify(params, null, 2)}</pre>
</body>
</html>`;

      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    if (
      url.pathname === "/github/authorize" ||
      url.pathname === "/google/authorize"
    ) {
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state");
      if (!redirectUri || !state) {
        return new Response("Missing redirect_uri or state", { status: 400 });
      }

      const callback = new URL(redirectUri);
      callback.searchParams.set(
        "code",
        readCookie(req, "rxlab-e2e-social-profile") ||
          Buffer.from(JSON.stringify(DEFAULT_SOCIAL_PROFILE)).toString(
            "base64url",
          ),
      );
      callback.searchParams.set("state", state);
      return Response.redirect(callback, 302);
    }

    if (
      url.pathname === "/github/token" ||
      url.pathname === "/google/token"
    ) {
      const body = new URLSearchParams(await req.text());
      return Response.json({ access_token: body.get("code") || "" });
    }

    if (url.pathname === "/github/user") {
      const profile = bearerProfile(req);
      return Response.json({
        id: Number(profile.accountId.replace(/\D/g, "")) || 1001,
        login: profile.email.split("@")[0],
        name: profile.name,
        avatar_url: null,
      });
    }

    if (url.pathname === "/github/emails") {
      const profile = bearerProfile(req);
      return Response.json([
        { email: profile.email, primary: true, verified: true },
      ]);
    }

    if (url.pathname === "/google/user") {
      const profile = bearerProfile(req);
      return Response.json({
        sub: profile.accountId,
        email: profile.email,
        email_verified: true,
        name: profile.name,
        picture: null,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Mock OAuth callback server running on http://localhost:${server.port}`);
