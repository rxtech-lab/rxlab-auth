import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SIGN_IN_METHODS,
  filterSocialProviders,
  isSignInMethodEnabled,
  isSocialProviderEnabled,
  parseSignInMethods,
  serializeSignInMethods,
} from "./sign-in-methods";

describe("parseSignInMethods", () => {
  // Fail-open matters: a corrupt column must not lock everyone out of an app.
  test.each([
    ["null", null],
    ["empty string", ""],
    ["malformed JSON", "{not json"],
    ["an array", "[]"],
    ["a JSON null", "null"],
    ["a scalar", '"nope"'],
    ["an empty object", "{}"],
  ])("defaults everything to enabled for %s", (_label, raw) => {
    expect(parseSignInMethods(raw as string | null)).toEqual(
      DEFAULT_SIGN_IN_METHODS,
    );
  });

  test("honours explicit false values", () => {
    const methods = parseSignInMethods(
      JSON.stringify({
        password: false,
        passkey: true,
        social: { github: false, google: true, apple: false },
      }),
    );

    expect(methods.password).toBe(false);
    expect(methods.passkey).toBe(true);
    expect(methods.social).toEqual({
      github: false,
      google: true,
      apple: false,
    });
  });

  // A provider added after a client was configured must default to available,
  // not silently vanish from that client.
  test("treats unknown/missing providers as enabled", () => {
    const methods = parseSignInMethods(
      JSON.stringify({ password: false, social: { github: false } }),
    );

    expect(methods.password).toBe(false);
    expect(methods.passkey).toBe(true);
    expect(methods.social.github).toBe(false);
    expect(methods.social.google).toBe(true);
    expect(methods.social.apple).toBe(true);
  });

  test("ignores non-boolean values", () => {
    const methods = parseSignInMethods(
      JSON.stringify({ password: "no", social: { github: 0 } }),
    );

    expect(methods.password).toBe(true);
    expect(methods.social.github).toBe(true);
  });
});

describe("serializeSignInMethods", () => {
  test("round-trips", () => {
    const methods = parseSignInMethods(
      JSON.stringify({
        password: false,
        passkey: true,
        social: { github: true, google: false, apple: true },
      }),
    );

    expect(parseSignInMethods(serializeSignInMethods(methods))).toEqual(methods);
  });

  test("always writes every known provider", () => {
    const written = JSON.parse(serializeSignInMethods(DEFAULT_SIGN_IN_METHODS));
    expect(Object.keys(written.social).sort()).toEqual([
      "apple",
      "github",
      "google",
    ]);
  });
});

describe("predicates", () => {
  const methods = parseSignInMethods(
    JSON.stringify({
      password: false,
      passkey: true,
      social: { github: true, google: false, apple: false },
    }),
  );

  test("isSignInMethodEnabled", () => {
    expect(isSignInMethodEnabled(methods, "password")).toBe(false);
    expect(isSignInMethodEnabled(methods, "passkey")).toBe(true);
  });

  test("isSocialProviderEnabled", () => {
    expect(isSocialProviderEnabled(methods, "github")).toBe(true);
    expect(isSocialProviderEnabled(methods, "google")).toBe(false);
  });

  // The client list narrows the server-configured list; it can never add to it.
  test("filterSocialProviders intersects with what the server offers", () => {
    const configured = [{ id: "google" as const }, { id: "apple" as const }];
    expect(filterSocialProviders(configured, methods)).toEqual([]);

    const withGithub = [...configured, { id: "github" as const }];
    expect(filterSocialProviders(withGithub, methods)).toEqual([
      { id: "github" },
    ]);
  });
});
