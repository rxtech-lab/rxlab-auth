"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, KeyRound } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/actions/auth/login";
import { usePasskey } from "@/hooks/use-passkey";
import type { SocialProviderDescriptor } from "@/lib/auth/social/providers";
import { socialSigninErrorMessage } from "@/lib/auth/social/errors";

interface LoginFormProps {
  socialProviders?: SocialProviderDescriptor[];
}

function SocialProviderIcon({
  provider,
}: {
  provider: SocialProviderDescriptor;
}) {
  if (provider.id === "google") {
    return (
      <Image
        src={provider.iconPath}
        alt=""
        width={20}
        height={20}
        aria-hidden="true"
      />
    );
  }

  return (
    <span aria-hidden="true" className="inline-flex h-4 w-[17px]">
      <Image
        src={provider.iconPath}
        alt=""
        width={98}
        height={96}
        className="h-4 w-auto dark:hidden"
      />
      <Image
        src={provider.darkIconPath}
        alt=""
        width={98}
        height={96}
        className="hidden h-4 w-auto dark:block"
      />
    </span>
  );
}

export function LoginForm({ socialProviders = [] }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/account";
  const resetSuccess = searchParams.get("reset") === "true";
  const socialError = searchParams.get("error");
  const socialErrorMessage = socialSigninErrorMessage(socialError);
  const registerHref =
    redirectTo === "/account"
      ? "/register"
      : `/register?redirect=${encodeURIComponent(redirectTo)}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    isLoading: isPasskeyLoading,
    error: passkeyError,
    authenticateWithPasskey,
  } = usePasskey({
    onSuccess: () => router.push(redirectTo),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await login({ email, password });
      if (result.success) {
        router.push(redirectTo);
      } else if (result.needsVerification) {
        router.push("/verify-email?resend=true");
      } else {
        setError(result.error || "Login failed");
      }
    });
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    await authenticateWithPasskey(email || undefined);
  };

  const isLoading = isPending || isPasskeyLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-sm space-y-8"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-[15px]">
          Sign in to your account to continue
        </p>
      </div>

      {resetSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-500/10 text-green-600 dark:text-green-400 text-sm rounded-xl p-3.5"
        >
          Your password has been reset. You can now sign in.
        </motion.div>
      )}

      {(error || passkeyError || socialErrorMessage) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 text-destructive text-sm rounded-xl p-3.5"
        >
          {error || passkeyError || socialErrorMessage}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/reset-password"
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-muted-foreground">
            or
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {socialProviders.map((provider) => {
          const params = new URLSearchParams({ redirect: redirectTo });
          return (
            <a
              key={provider.id}
              href={`/api/auth/social/${provider.id}?${params.toString()}`}
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
              data-testid={`social-signin-${provider.id}`}
            >
              <SocialProviderIcon provider={provider} />
              {provider.label}
            </a>
          );
        })}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handlePasskeyLogin}
          disabled={isLoading}
        >
          {isPasskeyLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <KeyRound className="size-4" />
              Sign in with Passkey
            </>
          )}
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href={registerHref}
          className="text-primary hover:text-primary/80 transition-colors"
        >
          Sign up
        </Link>
      </p>
    </motion.div>
  );
}
