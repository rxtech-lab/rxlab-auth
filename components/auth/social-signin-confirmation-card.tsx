"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  cancelSocialSignin,
  confirmSocialSignin,
} from "@/actions/auth/social-signin";
import type { SocialProfile } from "@/lib/auth/social/providers";

interface SocialSigninConfirmationCardProps {
  kind: "connect" | "create";
  profile: SocialProfile;
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

export function SocialSigninConfirmationCard({
  kind,
  profile,
}: SocialSigninConfirmationCardProps) {
  const router = useRouter();
  const provider = PROVIDERS[profile.provider];
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCancelling, setIsCancelling] = useState(false);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmSocialSignin();
      if (result.success && result.redirectUrl) {
        router.replace(result.redirectUrl);
        return;
      }
      setError(result.error || "Social sign-in could not be completed.");
    });
  };

  const handleCancel = () => {
    setError(null);
    setIsCancelling(true);
    startTransition(async () => {
      const result = await cancelSocialSignin();
      router.replace(result.redirectUrl);
    });
  };

  const isConnect = kind === "connect";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-md"
    >
      <Card>
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted">
            <Image
              src={provider.iconPath}
              alt=""
              width={36}
              height={36}
              className={
                profile.provider === "github"
                  ? "size-9 dark:hidden"
                  : "size-9"
              }
            />
            {profile.provider === "github" && (
              <Image
                src={provider.darkIconPath}
                alt=""
                width={36}
                height={36}
                className="hidden size-9 dark:block"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              {isConnect ? "Connect your accounts?" : "Create your account?"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isConnect
                ? `An RxLab Auth account already uses ${profile.email}.`
                : `No RxLab Auth account exists for ${profile.email}.`}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive"
            >
              {error}
            </motion.div>
          )}

          <div className="rounded-2xl bg-muted/60 p-4">
            <div className="flex items-center gap-3">
              {isConnect ? (
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
                  <ArrowRight className="size-5 text-primary" />
                </div>
              ) : (
                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
                  <UserPlus className="size-5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {profile.name || profile.email}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile.email} via {provider.name}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            {isConnect
              ? `Connecting lets you use ${provider.name} to sign in to your existing account. Your current account data stays in the same account.`
              : `Continuing creates an RxLab Auth account using your verified ${provider.name} email. You can manage this connection after signing in.`}
          </p>

          {!isConnect && (
            <p className="text-xs leading-5 text-muted-foreground">
              By creating an account, you agree to our{" "}
              <Link href="/terms" className="text-primary hover:text-primary/80">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary hover:text-primary/80">
                Privacy Policy
              </Link>
              .
            </p>
          )}
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
            disabled={isPending}
            data-testid="cancel-social-signin"
          >
            {isPending && isCancelling ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel"
            )}
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={isPending}
            data-testid="confirm-social-signin"
          >
            {isPending && !isCancelling ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {isConnect ? "Connecting..." : "Creating..."}
              </>
            ) : (
              <>
                <CheckCircle className="size-4" />
                {isConnect ? "Connect accounts" : "Create account"}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
