import { describe, expect, test } from "bun:test";
import {
  buildSigninSchema,
  buildSignupSchema,
  type OAuthClientLite,
} from "./build";

const FIRST_PARTY: OAuthClientLite = {
  id: "macos-test-app",
  name: "macOS Test App",
  signInPermission: "all",
};

const RESTRICTED: OAuthClientLite = {
  id: "locked",
  name: "Locked Client",
  signInPermission: "none",
};

describe("buildSigninSchema", () => {
  test("first-party client exposes both passkey and password", () => {
    const schema = buildSigninSchema({
      client: FIRST_PARTY,
      identityProviders: [
        {
          id: "github",
          label: "Continue with GitHub",
          iconUrl: "https://auth.rxlab.app/brand/github-invertocat-black.svg",
          darkIconUrl:
            "https://auth.rxlab.app/brand/github-invertocat-white.svg",
        },
        {
          id: "google",
          label: "Continue with Google",
          iconUrl: "https://auth.rxlab.app/brand/google-g.svg",
          darkIconUrl: "https://auth.rxlab.app/brand/google-g.svg",
        },
      ],
    });

    expect(schema.flow).toBe("signin");
    expect(schema.title).toBe("Sign in to macOS Test App");
    expect(schema.submitLabel).toBe("Sign in");

    const methodIds = schema.supportedMethods.map((m) => m.id);
    expect(methodIds).toEqual(["password", "passkey"]);
    expect(schema.supportedMethods[0]?.primary).toBe(true);
    expect(schema.identityProviders).toEqual([
      {
        id: "github",
        label: "Continue with GitHub",
        iconUrl: "https://auth.rxlab.app/brand/github-invertocat-black.svg",
        darkIconUrl:
          "https://auth.rxlab.app/brand/github-invertocat-white.svg",
        authorizationParameters: { identity_provider: "github" },
      },
      {
        id: "google",
        label: "Continue with Google",
        iconUrl: "https://auth.rxlab.app/brand/google-g.svg",
        darkIconUrl: "https://auth.rxlab.app/brand/google-g.svg",
        authorizationParameters: { identity_provider: "google" },
      },
    ]);
  });

  test("client with signInPermission!=all hides password + passkey", () => {
    const schema = buildSigninSchema({ client: RESTRICTED });
    expect(schema.supportedMethods).toEqual([]);
    expect(schema.identityProviders).toEqual([]);
  });

  test("no client_id falls back to default title", () => {
    const schema = buildSigninSchema({ client: null });
    expect(schema.title).toBe("Sign in to RxLab");
    expect(schema.supportedMethods).toEqual([]);
    expect(schema.identityProviders).toEqual([]);
  });

  test("fields include email + password with derived validation", () => {
    const schema = buildSigninSchema({ client: FIRST_PARTY });
    const keys = schema.fields.map((f) => f.key);
    expect(keys).toEqual(["email", "password"]);

    const email = schema.fields[0]!;
    expect(email.type).toBe("email");
    expect(email.isPassword).toBe(false);
    expect(email.required).toBe(true);
    expect(email.autocomplete).toBe("username");
    // Email validation is sourced from emailSchema, so pattern + minLength
    // come from zod-to-json-schema. We just assert the shape is present.
    expect(typeof email.validation.pattern).toBe("string");
    expect(email.validation.minLength).toBeGreaterThan(0);

    const password = schema.fields[1]!;
    expect(password.type).toBe("password");
    expect(password.isPassword).toBe(true);
    expect(password.autocomplete).toBe("current-password");
    expect(password.validation.minLength).toBe(8);
    expect(password.validation.maxLength).toBe(128);
  });
});

describe("buildSignupSchema", () => {
  test("first-party client with sign-up allowed (flag off) exposes legacy passkey + password", () => {
    const schema = buildSignupSchema({
      client: FIRST_PARTY,
      signUpAllowed: true,
    });

    expect(schema.flow).toBe("signup");
    expect(schema.title).toBe("Create your macOS Test App account");
    expect(schema.submitLabel).toBe("Create account");

    const methodIds = schema.supportedMethods.map((m) => m.id);
    expect(methodIds).toEqual(["password", "passkey"]);
  });

  test("accountCreationEnabled replaces legacy passkey with passkey_account_creation", () => {
    const schema = buildSignupSchema({
      client: FIRST_PARTY,
      signUpAllowed: true,
      accountCreationEnabled: true,
    });

    const methodIds = schema.supportedMethods.map((m) => m.id);
    expect(methodIds).toEqual(["password", "passkey_account_creation"]);
    expect(methodIds).not.toContain("passkey");

    const entry = schema.supportedMethods.find(
      (m) => m.id === "passkey_account_creation",
    );
    expect(entry).toEqual({
      id: "passkey_account_creation",
      label: "Sign up with Passkey",
      primary: false,
    });
    // Password is still primary; account-creation must not steal that.
    expect(schema.supportedMethods[0]?.id).toBe("password");
    expect(schema.supportedMethods[0]?.primary).toBe(true);
  });

  test("accountCreationEnabled default (off) omits passkey_account_creation", () => {
    const schema = buildSignupSchema({
      client: FIRST_PARTY,
      signUpAllowed: true,
    });
    const methodIds = schema.supportedMethods.map((m) => m.id);
    expect(methodIds).not.toContain("passkey_account_creation");
  });

  test("accountCreationEnabled is gated by signUpAllowed", () => {
    const schema = buildSignupSchema({
      client: FIRST_PARTY,
      signUpAllowed: false,
      accountCreationEnabled: true,
    });
    expect(schema.supportedMethods).toEqual([]);
  });

  test("accountCreationEnabled is gated by first-party client", () => {
    const schema = buildSignupSchema({
      client: RESTRICTED,
      signUpAllowed: true,
      accountCreationEnabled: true,
    });
    expect(schema.supportedMethods).toEqual([]);
  });

  test("sign-up disabled empties supportedMethods", () => {
    const schema = buildSignupSchema({
      client: FIRST_PARTY,
      signUpAllowed: false,
    });
    expect(schema.supportedMethods).toEqual([]);
  });

  test("non-first-party client empties supportedMethods", () => {
    const schema = buildSignupSchema({
      client: RESTRICTED,
      signUpAllowed: true,
    });
    expect(schema.supportedMethods).toEqual([]);
  });

  test("password field uses new-password autocomplete", () => {
    const schema = buildSignupSchema({
      client: FIRST_PARTY,
      signUpAllowed: true,
    });
    const password = schema.fields.find((f) => f.key === "password");
    expect(password?.autocomplete).toBe("new-password");
  });

  test("name field is optional", () => {
    const schema = buildSignupSchema({
      client: FIRST_PARTY,
      signUpAllowed: true,
    });
    const name = schema.fields.find((f) => f.key === "name");
    expect(name?.required).toBe(false);
    // displayNameSchema → max 64 chars
    expect(name?.validation.maxLength).toBe(64);
  });
});
