import { NextRequest, NextResponse } from "next/server";
import {
  completeSocialSignin,
  getSocialSigninIntent,
  SocialAccountError,
  type SocialSigninUser,
} from "@/lib/auth/social/accounts";
import { getAppleNativeAudiences } from "@/lib/auth/social/apple-client-secret";
import {
  AppleIdentityTokenError,
  verifyAppleIdentityToken,
} from "@/lib/auth/social/apple-identity-token";
import {
  appleProfileFromClaims,
  getSocialProvider,
  SocialProviderError,
} from "@/lib/auth/social/providers";
import { issueOAuthTokenResponse } from "@/lib/oauth/issue-tokens";
import {
  requireSocialProvider,
  resolveRequestedScopes,
  validateClientRedirect,
} from "@/lib/oauth/native-client";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { deleteAppleNonce, getAppleNonce } from "@/lib/redis";
import { appleNativeSigninRequestSchema } from "@/lib/validations/oauth";

// POST /api/oauth/social/apple
//
// Step 2 of native Sign in with Apple: the iOS/macOS client has run
// `ASAuthorizationAppleIDProvider` and holds an identity token. We verify it
// against Apple's JWKS, consume the nonce from step 1, then create or link the
// account and issue OAuth tokens.
//
// Response shape matches /api/oauth/token's authorization_code grant, same as
// the native passkey routes.
//
// Where this differs from the browser flow: the web callback parks an ambiguous
// result on /social/confirm and asks the user to approve linking. A native app
// has no such page, and Apple's email is provider-verified, so linking to an
// existing account with the same verified address happens automatically here —
// the same rule every major identity provider applies to verified federation.
function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppleIdentityTokenError) {
    const description =
      error.code === "invalid_nonce"
        ? "Identity token nonce mismatch"
        : error.code === "invalid_audience"
          ? "No native Apple audiences are configured"
          : "Apple identity token could not be verified";
    return NextResponse.json(
      { error: "invalid_grant", error_description: description },
      { status: 400 },
    );
  }

  if (error instanceof SocialProviderError) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description:
          error.code === "verified_email_required"
            ? "A verified email address is required to sign in"
            : "Sign in with Apple could not be completed",
      },
      { status: 400 },
    );
  }

  if (error instanceof SocialAccountError) {
    switch (error.code) {
      case "signup_disabled":
        return NextResponse.json(
          {
            error: "access_denied",
            error_description: "Sign-up is currently disabled",
          },
          { status: 403 },
        );
      case "signup_not_whitelisted":
        return NextResponse.json(
          {
            error: "access_denied",
            error_description:
              "Sign-up is restricted to approved email addresses",
          },
          { status: 403 },
        );
      case "account_conflict":
        return NextResponse.json(
          {
            error: "invalid_grant",
            error_description:
              "This provider is already linked to another account",
          },
          { status: 409 },
        );
      default:
        break;
    }
  }

  console.error("Native Apple sign-in failed:", error);
  return NextResponse.json(
    {
      error: "server_error",
      error_description: "Sign in with Apple could not be completed",
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  if (!getSocialProvider("apple")) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "Sign in with Apple is not configured",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = appleNativeSigninRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const nonceData = await getAppleNonce(data.session_id);
  if (
    !nonceData ||
    nonceData.clientId !== data.client_id ||
    nonceData.nonce !== data.nonce
  ) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "No Apple sign-in challenge found",
      },
      { status: 400 },
    );
  }

  // Re-validate the redirect_uri captured at nonce time against the client's
  // current allow-list, matching the passkey verify routes: the registered URIs
  // could have been edited in between.
  const clientCheck = await validateClientRedirect({
    clientId: data.client_id,
    redirectUri: nonceData.redirectUri,
  });
  if (!clientCheck.ok) return clientCheck.response;
  const client = clientCheck.client;

  const appleDisabled = requireSocialProvider(client, "apple");
  if (appleDisabled) return appleDisabled;

  const scopeCheck = resolveRequestedScopes(data.scope, client);
  if (!scopeCheck.ok) return scopeCheck.response;

  try {
    // Native tokens are audienced to the app's bundle identifier, not the
    // Services ID the browser flow uses, so the allow-list is separate.
    const claims = await verifyAppleIdentityToken({
      identityToken: data.identity_token,
      audiences: getAppleNativeAudiences(),
      expectedNonce: data.nonce,
    });

    // One-shot: burn the nonce as soon as it has done its job, so a retry of
    // the same request can't succeed twice.
    await deleteAppleNonce(data.session_id);

    const profile = appleProfileFromClaims(claims, {
      name: {
        firstName: data.full_name?.given_name,
        lastName: data.full_name?.family_name,
      },
    });

    const intent = await getSocialSigninIntent(profile);

    let signedInUser: SocialSigninUser;
    if (intent.kind === "sign_in") {
      signedInUser = intent.user;
    } else {
      signedInUser = await completeSocialSignin({
        kind: intent.kind,
        profile,
        redirectTo: "/account",
        userId: intent.kind === "connect" ? intent.user.id : undefined,
        oauthClientId: client.id,
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, signedInUser.id),
    });
    if (!user) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "User not found" },
        { status: 400 },
      );
    }

    const tokenResponse = await issueOAuthTokenResponse({
      user,
      client,
      scopes: scopeCheck.scopes,
    });

    return NextResponse.json(tokenResponse);
  } catch (error) {
    return errorResponse(error);
  }
}
