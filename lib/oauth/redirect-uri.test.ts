import { describe, expect, test } from "bun:test";
import { matchRedirectUri } from "./redirect-uri";

describe("matchRedirectUri", () => {
  describe("exact match (backward compatibility)", () => {
    test("should match exact URI", () => {
      expect(
        matchRedirectUri("https://example.com/callback", [
          "https://example.com/callback",
        ])
      ).toBe(true);
    });

    test("should not match different URI", () => {
      expect(
        matchRedirectUri("https://example.com/callback", [
          "https://other.com/callback",
        ])
      ).toBe(false);
    });

    test("should match when URI is in list of multiple patterns", () => {
      expect(
        matchRedirectUri("https://example.com/callback", [
          "https://other.com/callback",
          "https://example.com/callback",
        ])
      ).toBe(true);
    });
  });

  describe("wildcard subdomain patterns (*.domain.com)", () => {
    test("should match subdomain", () => {
      expect(
        matchRedirectUri("https://app.abc.com/callback", [
          "https://*.abc.com/callback",
        ])
      ).toBe(true);
    });

    test("should match different subdomain", () => {
      expect(
        matchRedirectUri("https://staging.abc.com/callback", [
          "https://*.abc.com/callback",
        ])
      ).toBe(true);
    });

    test("should not match bare domain (wildcard requires at least one char)", () => {
      expect(
        matchRedirectUri("https://.abc.com/callback", [
          "https://*.abc.com/callback",
        ])
      ).toBe(false);
    });

    test("should match nested subdomain", () => {
      expect(
        matchRedirectUri("https://a.b.abc.com/callback", [
          "https://*.abc.com/callback",
        ])
      ).toBe(true);
    });

    test("should not match wrong domain", () => {
      expect(
        matchRedirectUri("https://app.evil.com/callback", [
          "https://*.abc.com/callback",
        ])
      ).toBe(false);
    });
  });

  describe("wildcard prefix patterns (*domain.com)", () => {
    test("should match prefix", () => {
      expect(
        matchRedirectUri("https://myabc.com/callback", [
          "https://*abc.com/callback",
        ])
      ).toBe(true);
    });

    test("should match subdomain prefix", () => {
      expect(
        matchRedirectUri("https://app.abc.com/callback", [
          "https://*abc.com/callback",
        ])
      ).toBe(true);
    });

    test("should not match unrelated domain", () => {
      expect(
        matchRedirectUri("https://evil.com/callback", [
          "https://*abc.com/callback",
        ])
      ).toBe(false);
    });
  });

  describe("path matching", () => {
    test("should not match different path", () => {
      expect(
        matchRedirectUri("https://app.abc.com/other", [
          "https://*.abc.com/callback",
        ])
      ).toBe(false);
    });

    test("should not match with extra path segments", () => {
      expect(
        matchRedirectUri("https://app.abc.com/callback/extra", [
          "https://*.abc.com/callback",
        ])
      ).toBe(false);
    });

    test("should match exact path with wildcard host", () => {
      expect(
        matchRedirectUri("https://app.abc.com/auth/callback", [
          "https://*.abc.com/auth/callback",
        ])
      ).toBe(true);
    });
  });

  describe("mixed patterns (exact + wildcard)", () => {
    test("should match wildcard when exact does not match", () => {
      expect(
        matchRedirectUri("https://app.abc.com/callback", [
          "https://exact.com/callback",
          "https://*.abc.com/callback",
        ])
      ).toBe(true);
    });

    test("should match exact when wildcard does not match", () => {
      expect(
        matchRedirectUri("https://exact.com/callback", [
          "https://exact.com/callback",
          "https://*.abc.com/callback",
        ])
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("should return false for empty patterns array", () => {
      expect(matchRedirectUri("https://example.com/callback", [])).toBe(false);
    });

    test("should return false for empty URI", () => {
      expect(matchRedirectUri("", ["https://example.com/callback"])).toBe(
        false
      );
    });

    test("should not allow wildcard to cross into port", () => {
      expect(
        matchRedirectUri("https://evil.com:8080/callback", [
          "https://*.com/callback",
        ])
      ).toBe(false);
    });

    test("should not allow wildcard to cross into path", () => {
      expect(
        matchRedirectUri("https://evil.com/malicious/callback", [
          "https://*.com/callback",
        ])
      ).toBe(false);
    });

    test("should handle pattern with port", () => {
      expect(
        matchRedirectUri("https://app.abc.com:3000/callback", [
          "https://*.abc.com:3000/callback",
        ])
      ).toBe(true);
    });
  });
});
