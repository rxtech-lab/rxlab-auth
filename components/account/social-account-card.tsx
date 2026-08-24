"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disconnectSocialAccount } from "@/actions/account/social-accounts";
import type { SocialProviderId } from "@/lib/auth/social/providers";

interface SocialAccountCardProps {
  account: {
    provider: SocialProviderId;
    providerEmail: string;
    createdAt: Date;
  };
  canDisconnect: boolean;
}

const PROVIDERS = {
  github: {
    name: "GitHub",
    iconPath: "/brand/github-invertocat-black.svg",
    darkIconPath: "/brand/github-invertocat-white.svg",
  },
  google: {
    name: "Google",
    iconPath: "/brand/google-g.svg",
    darkIconPath: "/brand/google-g.svg",
  },
} as const;

export function SocialAccountCard({
  account,
  canDisconnect,
}: SocialAccountCardProps) {
  const provider = PROVIDERS[account.provider];
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDisconnect = () => {
    if (
      !confirm(
        `Disconnect ${provider.name}? You will no longer be able to sign in with this account.`,
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await disconnectSocialAccount(account.provider);
      if (!result.success) {
        setError(result.error || "Failed to disconnect social account.");
      }
    });
  };

  return (
    <div
      className="space-y-3 rounded-2xl bg-muted/50 p-4"
      data-testid={`connected-social-${account.provider}`}
    >
      {error && (
        <div className="rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background">
            <Image
              src={provider.iconPath}
              alt=""
              width={24}
              height={24}
              className={
                account.provider === "github"
                  ? "size-6 dark:hidden"
                  : "size-6"
              }
            />
            {account.provider === "github" && (
              <Image
                src={provider.darkIconPath}
                alt=""
                width={24}
                height={24}
                className="hidden size-6 dark:block"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium">{provider.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {account.providerEmail}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleDisconnect}
          disabled={isPending || !canDisconnect}
          data-testid={`disconnect-social-${account.provider}`}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Disconnect
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Connected {account.createdAt.toLocaleDateString()}</span>
        {!canDisconnect && (
          <Link
            href="/account/passkeys"
            className="text-primary hover:text-primary/80"
          >
            Add a passkey before disconnecting
          </Link>
        )}
      </div>
    </div>
  );
}
