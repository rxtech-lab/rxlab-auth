"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAndRedirect } from "@/actions/auth/reset-password";

export function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await requestPasswordResetAndRedirect({ email });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
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
        <h1 className="text-3xl font-semibold tracking-tight">
          Forgot your password?
        </h1>
        <p className="text-muted-foreground text-[15px]">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

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

        <Button
          type="submit"
          className="w-full"
          disabled={isPending}
          data-testid="send-reset-link"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending reset link...
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          Back to login
        </Link>
      </p>
    </motion.div>
  );
}
