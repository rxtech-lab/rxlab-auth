/**
 * Fetch a URL with retry logic and exponential backoff.
 * Useful for fetching resources that may not be immediately available
 * due to CDN propagation delays (e.g., Vercel Blob uploads).
 */
export async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<Response> {
  let lastResponse: Response = await fetch(url);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (lastResponse.ok) {
      return lastResponse;
    }

    const delay = baseDelayMs * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));

    lastResponse = await fetch(url);
  }

  return lastResponse;
}
