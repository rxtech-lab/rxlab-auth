/**
 * Parse Basic authentication header and extract client credentials
 * @param authHeader - The Authorization header value
 * @returns Object with clientId and clientSecret, or null if invalid
 */
export function parseBasicAuth(
  authHeader: string | null,
): { clientId: string; clientSecret: string | undefined } | null {
  if (!authHeader?.startsWith("Basic ")) {
    return null;
  }

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString(
      "utf-8",
    );
    const colonIndex = credentials.indexOf(":");

    if (colonIndex === -1) {
      return null;
    }

    const clientId = credentials.slice(0, colonIndex);
    const clientSecret = credentials.slice(colonIndex + 1);

    if (!clientId) {
      return null;
    }

    // Allow empty clientSecret for public clients
    return {
      clientId,
      clientSecret: clientSecret || undefined,
    };
  } catch {
    return null;
  }
}
