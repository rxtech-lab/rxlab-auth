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
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url);
    if (response.ok) {
      return response;
    }

    lastResponse = response;

    // Don't wait after the last attempt
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return lastResponse!;
}
