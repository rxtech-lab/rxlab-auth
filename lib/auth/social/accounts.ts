import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  oauthClients,
  oauthClientUserRoles,
  socialAccounts,
  users,
} from "@/lib/db/schema";
import type { SocialProfile } from "@/lib/auth/social/providers";
import { generateAvatarSeed } from "@/lib/identicon/generate";
import { checkSignUpAllowed } from "@/lib/settings/sign-up";
import { getOAuthClientIdFromRedirect } from "@/lib/auth/social/oauth-context";

export class SocialAccountError extends Error {
  constructor(
    public readonly code:
      | "account_conflict"
      | "flow_changed"
      | "signup_disabled"
      | "signup_not_whitelisted"
      | "user_not_found",
  ) {
    super(code);
    this.name = "SocialAccountError";
  }
}

export interface SocialSigninUser {
  id: string;
  email: string;
}

export type SocialSigninIntent =
  | { kind: "sign_in"; user: SocialSigninUser }
  | { kind: "connect"; user: SocialSigninUser }
  | { kind: "create" };

function normalizedDisplayName(profile: SocialProfile): string {
  const value = profile.name?.trim() || profile.email.split("@")[0];
  return value.slice(0, 64);
}

async function findLinkedUser(
  profile: SocialProfile,
): Promise<SocialSigninUser | null> {
  const linkedAccount = await db.query.socialAccounts.findFirst({
    where: and(
      eq(socialAccounts.provider, profile.provider),
      eq(socialAccounts.providerAccountId, profile.providerAccountId),
    ),
  });
  if (!linkedAccount) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, linkedAccount.userId),
  });
  if (!user) throw new SocialAccountError("user_not_found");

  if (linkedAccount.providerEmail !== profile.email) {
    await db
      .update(socialAccounts)
      .set({ providerEmail: profile.email, updatedAt: new Date() })
      .where(eq(socialAccounts.id, linkedAccount.id));
  }

  return { id: user.id, email: user.email };
}

export async function getSocialSigninIntent(
  profile: SocialProfile,
): Promise<SocialSigninIntent> {
  const linkedUser = await findLinkedUser(profile);
  if (linkedUser) return { kind: "sign_in", user: linkedUser };

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, profile.email),
  });

  if (existingUser) {
    const providerLink = await db.query.socialAccounts.findFirst({
      where: and(
        eq(socialAccounts.userId, existingUser.id),
        eq(socialAccounts.provider, profile.provider),
      ),
    });
    if (
      providerLink &&
      providerLink.providerAccountId !== profile.providerAccountId
    ) {
      throw new SocialAccountError("account_conflict");
    }

    return {
      kind: "connect",
      user: { id: existingUser.id, email: existingUser.email },
    };
  }

  const signUpCheck = await checkSignUpAllowed(profile.email);
  if (!signUpCheck.allowed) {
    throw new SocialAccountError(
      signUpCheck.reason === "not_whitelisted"
        ? "signup_not_whitelisted"
        : "signup_disabled",
    );
  }

  return { kind: "create" };
}

export async function completeSocialSignin(input: {
  kind: "connect" | "create";
  profile: SocialProfile;
  redirectTo: string;
  userId?: string;
}): Promise<SocialSigninUser> {
  const { profile } = input;
  const currentIntent = await getSocialSigninIntent(profile);

  if (input.kind === "connect") {
    if (
      currentIntent.kind !== "connect" ||
      !input.userId ||
      currentIntent.user.id !== input.userId
    ) {
      throw new SocialAccountError("flow_changed");
    }
  } else if (currentIntent.kind !== "create") {
    throw new SocialAccountError("flow_changed");
  }

  const existingUser =
    input.kind === "connect"
      ? await db.query.users.findFirst({
          where: eq(users.id, input.userId!),
        })
      : undefined;

  if (
    input.kind === "connect" &&
    (!existingUser || existingUser.email !== profile.email)
  ) {
    throw new SocialAccountError("user_not_found");
  }

  const userId = existingUser?.id || crypto.randomUUID();
  const now = new Date();
  const oauthClientId = getOAuthClientIdFromRedirect(input.redirectTo);
  const oauthClient = oauthClientId
    ? await db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, oauthClientId),
      })
    : undefined;

  await db.transaction(async (tx) => {
    if (!existingUser) {
      await tx.insert(users).values({
        id: userId,
        email: profile.email,
        emailVerified: true,
        passwordHash: null,
        displayName: normalizedDisplayName(profile),
        avatarSeed: generateAvatarSeed(),
        avatarUrl: profile.avatarUrl,
        createdAt: now,
        updatedAt: now,
      });

      if (oauthClient?.defaultRoleId) {
        await tx.insert(oauthClientUserRoles).values({
          id: crypto.randomUUID(),
          clientId: oauthClient.id,
          userId,
          roleId: oauthClient.defaultRoleId,
          createdAt: now,
        });
      }
    } else {
      await tx
        .update(users)
        .set({
          emailVerified: true,
          displayName:
            existingUser.displayName || normalizedDisplayName(profile),
          avatarUrl: existingUser.avatarUrl || profile.avatarUrl,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    }

    await tx.insert(socialAccounts).values({
      id: crypto.randomUUID(),
      userId,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      providerEmail: profile.email,
      createdAt: now,
      updatedAt: now,
    });
  });

  return { id: userId, email: profile.email };
}
