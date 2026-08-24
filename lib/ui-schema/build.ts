import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  displayNameSchema,
} from "@/lib/validations/auth";

export type Flow = "signin" | "signup";

export type FieldType = "text" | "email" | "password" | "name";

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface UiField {
  key: string;
  label: string;
  placeholder: string;
  type: FieldType;
  isPassword: boolean;
  required: boolean;
  autocomplete?: string;
  validation: FieldValidation;
}

export type AuthMethodId = "password" | "passkey" | "passkey_account_creation";

export interface UiMethod {
  id: AuthMethodId;
  label: string;
  primary: boolean;
}

export type IdentityProviderId = "github" | "google";

export interface UiIdentityProvider {
  id: IdentityProviderId;
  label: string;
  iconUrl: string;
  darkIconUrl: string;
  authorizationParameters: {
    identity_provider: IdentityProviderId;
  };
}

export interface UiLink {
  id: string;
  label: string;
  href: string;
}

export interface UiSchema {
  flow: Flow;
  title: string;
  submitLabel: string;
  fields: UiField[];
  supportedMethods: UiMethod[];
  identityProviders?: UiIdentityProvider[];
  links: UiLink[];
}

export interface OAuthClientLite {
  id: string;
  name: string;
  signInPermission: "all" | "none" | "whitelist";
}

// Derive { minLength, maxLength, pattern } from a Zod string schema using the
// JSON-schema export built into Zod 4. Keeps the UI rules in lockstep with the
// server's actual validators (no hand-duplicated regexes).
function describeStringField(
  schema: z.ZodTypeAny,
  patternMessage?: string,
): FieldValidation {
  const json = z.toJSONSchema(schema) as {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  const out: FieldValidation = {};
  if (typeof json.minLength === "number") out.minLength = json.minLength;
  if (typeof json.maxLength === "number") out.maxLength = json.maxLength;
  if (typeof json.pattern === "string") {
    out.pattern = json.pattern;
    if (patternMessage) out.patternMessage = patternMessage;
  }
  return out;
}

function emailField(): UiField {
  return {
    key: "email",
    label: "Email",
    placeholder: "you@example.com",
    type: "email",
    isPassword: false,
    required: true,
    autocomplete: "username",
    validation: describeStringField(emailSchema, "Enter a valid email address"),
  };
}

function passwordField(opts: { autocomplete: "current-password" | "new-password" }): UiField {
  return {
    key: "password",
    label: "Password",
    placeholder: "Your password",
    type: "password",
    isPassword: true,
    required: true,
    autocomplete: opts.autocomplete,
    validation: describeStringField(passwordSchema),
  };
}

function nameField(): UiField {
  return {
    key: "name",
    label: "Name",
    placeholder: "Your name",
    type: "name",
    isPassword: false,
    required: false,
    autocomplete: "name",
    validation: describeStringField(displayNameSchema),
  };
}

export interface BuildSigninInput {
  client: OAuthClientLite | null;
  identityProviders?: Array<{
    id: IdentityProviderId;
    label: string;
    iconUrl: string;
    darkIconUrl: string;
  }>;
}

export function buildSigninSchema(input: BuildSigninInput): UiSchema {
  const { client, identityProviders = [] } = input;
  const passwordAllowed = client?.signInPermission === "all";

  const methods: UiMethod[] = [];
  if (passwordAllowed) {
    methods.push({
      id: "password",
      label: "Sign in with password",
      primary: true,
    });
    methods.push({
      id: "passkey",
      label: "Sign in with passkey",
      primary: false,
    });
  }

  const title = client?.name
    ? `Sign in to ${client.name}`
    : "Sign in to RxLab";

  return {
    flow: "signin",
    title,
    submitLabel: "Sign in",
    fields: [emailField(), passwordField({ autocomplete: "current-password" })],
    supportedMethods: methods,
    identityProviders: passwordAllowed
      ? identityProviders.map((provider) => ({
          ...provider,
          authorizationParameters: { identity_provider: provider.id },
        }))
      : [],
    links: [
      { id: "forgot-password", label: "Forgot password?", href: "/reset" },
      {
        id: "switch-to-signup",
        label: "Create an account",
        href: "/signup",
      },
    ],
  };
}

export interface BuildSignupInput {
  client: OAuthClientLite | null;
  signUpAllowed: boolean;
  // Feature flag for the iOS 26 / macOS 26
  // ASAuthorizationAccountCreationProvider system-sheet flow. When true and
  // sign-up is otherwise allowed, the schema advertises the
  // `passkey_account_creation` method so native clients can render the
  // "Sign up with Passkey" button that triggers the OS sheet (which collects
  // email/name itself — no extra fields needed).
  accountCreationEnabled?: boolean;
}

export function buildSignupSchema(input: BuildSignupInput): UiSchema {
  const { client, signUpAllowed, accountCreationEnabled = false } = input;
  const firstParty = client?.signInPermission === "all";

  const methods: UiMethod[] = [];
  if (firstParty && signUpAllowed) {
    methods.push({
      id: "password",
      label: "Sign up with password",
      primary: true,
    });
    // The Apple system-sheet flow (passkey_account_creation) supersedes the
    // legacy `passkey` signup button — the latter required us to collect an
    // email field up front, while the OS sheet collects it itself. When the
    // new flow is on, only emit the system-sheet method.
    if (accountCreationEnabled) {
      methods.push({
        id: "passkey_account_creation",
        label: "Sign up with Passkey",
        primary: false,
      });
    } else {
      methods.push({
        id: "passkey",
        label: "Sign up with passkey",
        primary: false,
      });
    }
  }

  const title = client?.name
    ? `Create your ${client.name} account`
    : "Create your RxLab account";

  return {
    flow: "signup",
    title,
    submitLabel: "Create account",
    fields: [
      emailField(),
      passwordField({ autocomplete: "new-password" }),
      nameField(),
    ],
    supportedMethods: methods,
    links: [
      { id: "switch-to-signin", label: "Already have an account?", href: "/login" },
    ],
  };
}
