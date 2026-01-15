"use server";

import { db } from "@/lib/db";
import { oauthClients, oauthConsents } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { storeOAuthCode, type OAuthCodeData } from "@/lib/redis";
import { generateAuthorizationCode } from "@/lib/oauth/jwt";
import { parseScopes } from "@/lib/validations/oauth";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";

export interface ConsentParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  nonce?: string;
}

export interface ConsentResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
}

export async function approveConsent(params: ConsentParams): Promise<ConsentResult> {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return { success: false, error: "Unauthorized" };
    }

    const {
      clientId,
      redirectUri,
      scope,
      state,
      codeChallenge,
      codeChallengeMethod,
      nonce,
    } = params;

    // Validate client
    const client = await db.query.oauthClients.findFirst({
      where: eq(oauthClients.id, clientId),
    });

    if (!client) {
      return { success: false, error: "Invalid client" };
    }

    // Validate redirect URI
    const allowedRedirectUris: string[] = JSON.parse(client.redirectUris);
    if (!allowedRedirectUris.includes(redirectUri)) {
      return { success: false, error: "Invalid redirect URI" };
    }

    const scopes = parseScopes(scope);

    // Store or update consent
    const existingConsent = await db.query.oauthConsents.findFirst({
      where: and(
        eq(oauthConsents.userId, session.userId),
        eq(oauthConsents.clientId, clientId)
      ),
    });

    if (existingConsent) {
      // Merge scopes
      const existingScopes: string[] = JSON.parse(existingConsent.scopes);
      const mergedScopes = [...new Set([...existingScopes, ...scopes])];

      await db
        .update(oauthConsents)
        .set({
          scopes: JSON.stringify(mergedScopes),
          updatedAt: new Date(),
        })
        .where(eq(oauthConsents.id, existingConsent.id));
    } else {
      await db.insert(oauthConsents).values({
        id: crypto.randomUUID(),
        userId: session.userId,
        clientId,
        scopes: JSON.stringify(scopes),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Generate authorization code
    const code = generateAuthorizationCode();
    const codeData: OAuthCodeData = {
      clientId,
      userId: session.userId,
      redirectUri,
      scopes,
      codeChallenge,
      codeChallengeMethod,
      nonce,
      createdAt: Date.now(),
    };

    await storeOAuthCode(code, codeData);

    // Build redirect URL
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);

    return { success: true, redirectUrl: redirectUrl.toString() };
  } catch (error) {
    console.error("Consent approval error:", error);
    return { success: false, error: "Failed to process consent" };
  }
}

export async function denyConsent(
  redirectUri: string,
  state?: string
): Promise<void> {
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("error", "access_denied");
  redirectUrl.searchParams.set("error_description", "User denied the request");
  if (state) redirectUrl.searchParams.set("state", state);

  redirect(redirectUrl.toString());
}
