"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "@/actions/auth/register";

interface RegisterFormProps {
  whitelistOnly?: boolean;
}

export function RegisterForm({ whitelistOnly = false }: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/account";
  const loginHref =
    redirectTo === "/account"
      ? "/login"
      : `/login?redirect=${encodeURIComponent(redirectTo)}`;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await register({ email, password, displayName: displayName || undefined });
      if (result.success) {
        if (process.env.NEXT_PUBLIC_E2E_SKIP_EMAIL_VERIFICATION === "true") {
          const target = redirectTo === "/account" ? "/account?setup=passkey" : redirectTo;
          router.push(target);
        } else {
          router.push("/verify-email?sent=true");
        }
      } else {
        setError(result.error || "Registration failed");
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-sm space-y-8"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-muted-foreground text-[15px]">
          Enter your details to get started
        </p>
      </div>

      {whitelistOnly && (
        <div className="flex gap-2.5 items-start bg-primary/10 text-primary text-sm rounded-xl p-3.5">
          <Info className="size-4 mt-0.5 shrink-0" />
          <p>Sign-up is restricted to approved emails only.</p>
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 text-destructive text-sm rounded-xl p-3.5"
        >
          {error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            type="text"
            placeholder="John Doe"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            Must be at least 8 characters long
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={loginHref}
          className="text-primary hover:text-primary/80 transition-colors"
        >
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{" "}
        <Link href="/terms" className="text-primary hover:text-primary/80 transition-colors">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors">
          Privacy Policy
        </Link>
      </p>
    </motion.div>
  );
}
