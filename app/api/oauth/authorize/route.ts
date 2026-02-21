import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oauthClients, oauthConsents } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { storeOAuthCode, type OAuthCodeData } from "@/lib/redis";
import { generateAuthorizationCode } from "@/lib/oauth/jwt";
import {
  authorizeRequestSchema,
  parseScopes,
  validateScopes,
} from "@/lib/validations/oauth";
import { eq, and } from "drizzle-orm";

function isBrowserRequest(request: Request): boolean {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function errorResponse(
  request: NextRequest,
  error: string,
  errorDescription: string,
  status: number
): NextResponse {
  if (isBrowserRequest(request)) {
    const errorUrl = new URL("/oauth/error", request.url);
    errorUrl.searchParams.set("error", error);
    errorUrl.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(errorUrl);
  }
  return NextResponse.json(
    { error, error_description: errorDescription },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse and validate request parameters
  const params = {
    client_id: searchParams.get("client_id") || "",
    redirect_uri: searchParams.get("redirect_uri") || "",
    response_type: searchParams.get("response_type") || "",
    scope: searchParams.get("scope") || "",
    state: searchParams.get("state") || undefined,
    code_challenge: searchParams.get("code_challenge") || "",
    code_challenge_method: searchParams.get("code_challenge_method") || "",
    nonce: searchParams.get("nonce") || undefined,
  };

  const parsed = authorizeRequestSchema.safeParse(params);
  if (!parsed.success) {
    const errorMessage = parsed.error.issues[0]?.message || "Invalid request";
    return errorResponse(request, "invalid_request", errorMessage, 400);
  }

  const {
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    nonce,
  } = parsed.data;

  // Validate client
  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, client_id),
  });

  if (!client) {
    return errorResponse(request, "invalid_client", "Client not found", 400);
  }

  // Validate redirect URI
  const allowedRedirectUris: string[] = JSON.parse(client.redirectUris);
  if (!allowedRedirectUris.includes(redirect_uri)) {
    return errorResponse(
      request,
      "invalid_redirect_uri",
      `The redirect URI does not match the registered URI: ${redirect_uri}`,
      400
    );
  }

  // Validate scopes
  const requestedScopes = parseScopes(scope);
  const allowedScopes: string[] = JSON.parse(client.allowedScopes);
  if (!validateScopes(requestedScopes, allowedScopes)) {
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("error", "invalid_scope");
    if (state) redirectUrl.searchParams.set("state", state);
    return NextResponse.redirect(redirectUrl);
  }

  // Check if user is authenticated
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    // Store OAuth params in session and redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "redirect",
      `/api/oauth/authorize?${searchParams.toString()}`
    );
    return NextResponse.redirect(loginUrl);
  }

  // Check for existing consent
  const existingConsent = await db.query.oauthConsents.findFirst({
    where: and(
      eq(oauthConsents.userId, session.userId),
      eq(oauthConsents.clientId, client_id)
    ),
  });

  const existingScopes: string[] = existingConsent
    ? JSON.parse(existingConsent.scopes)
    : [];
  const hasAllScopes = requestedScopes.every((s) => existingScopes.includes(s));

  // If first-party client or has existing consent with all requested scopes
  if (client.isFirstParty || (existingConsent && hasAllScopes)) {
    // Generate authorization code
    const code = generateAuthorizationCode();
    const codeData: OAuthCodeData = {
      clientId: client_id,
      userId: session.userId,
      redirectUri: redirect_uri,
      scopes: requestedScopes,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      nonce,
      createdAt: Date.now(),
    };

    await storeOAuthCode(code, codeData);

    // Redirect with authorization code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect to consent page
  const consentUrl = new URL("/oauth/authorize", request.url);
  consentUrl.searchParams.set("client_id", client_id);
  consentUrl.searchParams.set("redirect_uri", redirect_uri);
  consentUrl.searchParams.set("scope", scope);
  if (state) consentUrl.searchParams.set("state", state);
  consentUrl.searchParams.set("code_challenge", code_challenge);
  consentUrl.searchParams.set("code_challenge_method", code_challenge_method);
  if (nonce) consentUrl.searchParams.set("nonce", nonce);

  return NextResponse.redirect(consentUrl);
}
