import { Page, CDPSession } from "@playwright/test";

// Helper to set up WebAuthn virtual authenticator
export async function setupWebAuthn(
  page: Page
): Promise<{ cdpSession: CDPSession; authenticatorId: string }> {
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send("WebAuthn.enable");
  const result = await cdpSession.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  return { cdpSession, authenticatorId: result.authenticatorId };
}
