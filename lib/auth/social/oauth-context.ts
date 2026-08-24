export function getOAuthClientIdFromRedirect(
  redirectTo: string,
): string | undefined {
  const url = new URL(redirectTo, "https://auth.invalid");
  if (url.origin !== "https://auth.invalid") return undefined;
  if (url.pathname !== "/api/oauth/authorize") return undefined;
  return url.searchParams.get("client_id") || undefined;
}
