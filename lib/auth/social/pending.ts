import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { emailSchema } from "@/lib/validations/auth";
import { SOCIAL_PROVIDER_IDS } from "@/lib/auth/social/providers";
import { sanitizeRedirectPath } from "@/lib/auth/social/state";

const PENDING_TTL_SECONDS = 10 * 60;

export const pendingSocialSigninCookieName = "rxlab-social-signin-pending";

export const pendingSocialSigninCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/social/confirm",
  maxAge: PENDING_TTL_SECONDS,
};

const socialProfileSchema = z.object({
  provider: z.enum(SOCIAL_PROVIDER_IDS),
  providerAccountId: z.string().min(1),
  email: emailSchema,
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
});

const pendingSocialSigninSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("connect"),
    userId: z.string().min(1),
    profile: socialProfileSchema,
    redirectTo: z.string(),
  }),
  z.object({
    kind: z.literal("create"),
    profile: socialProfileSchema,
    redirectTo: z.string(),
  }),
]);

export type PendingSocialSignin = z.infer<typeof pendingSocialSigninSchema>;

function signingKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required");
  return new TextEncoder().encode(secret);
}

export async function createPendingSocialSignin(
  input: PendingSocialSignin,
): Promise<string> {
  const pending = pendingSocialSigninSchema.parse({
    ...input,
    redirectTo: sanitizeRedirectPath(input.redirectTo),
  });

  return new SignJWT(pending)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TTL_SECONDS}s`)
    .sign(signingKey());
}

export async function verifyPendingSocialSignin(
  token: string,
): Promise<PendingSocialSignin> {
  const { payload } = await jwtVerify(token, signingKey(), {
    algorithms: ["HS256"],
  });
  const pending = pendingSocialSigninSchema.parse(payload);

  return {
    ...pending,
    redirectTo: sanitizeRedirectPath(pending.redirectTo),
  };
}
