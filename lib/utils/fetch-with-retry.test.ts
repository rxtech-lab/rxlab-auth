import { describe, expect, test, mock, afterEach } from "bun:test";
import { fetchWithRetry } from "./fetch-with-retry";

describe("fetchWithRetry", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("should return response on first successful fetch", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    globalThis.fetch = mock(() => Promise.resolve(mockResponse));

    const result = await fetchWithRetry("https://example.com/image.webp");

    expect(result.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  test("should retry on non-ok response and succeed", async () => {
    const failResponse = new Response("not found", { status: 404 });
    const successResponse = new Response("ok", { status: 200 });

    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(failResponse);
      return Promise.resolve(successResponse);
    });

    const result = await fetchWithRetry(
      "https://example.com/image.webp",
      3,
      10
    );

    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  test("should return last failed response after all retries exhausted", async () => {
    const failResponse = new Response("not found", { status: 404 });
    globalThis.fetch = mock(() => Promise.resolve(failResponse));

    const result = await fetchWithRetry(
      "https://example.com/image.webp",
      2,
      10
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    // 1 initial + 2 retries = 3 total calls
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  test("should succeed on the last retry attempt", async () => {
    const failResponse = new Response("not found", { status: 404 });
    const successResponse = new Response("ok", { status: 200 });

    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      if (callCount <= 3) return Promise.resolve(failResponse);
      return Promise.resolve(successResponse);
    });

    const result = await fetchWithRetry(
      "https://example.com/image.webp",
      3,
      10
    );

    expect(result.ok).toBe(true);
    expect(callCount).toBe(4);
  });

  test("should use default parameters", async () => {
    const successResponse = new Response("ok", { status: 200 });
    globalThis.fetch = mock(() => Promise.resolve(successResponse));

    const result = await fetchWithRetry("https://example.com/image.webp");

    expect(result.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
