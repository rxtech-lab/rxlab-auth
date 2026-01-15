"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyEmail, resendVerificationEmail } from "@/actions/auth/verify-email";

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const sent = searchParams.get("sent") === "true";
  const resend = searchParams.get("resend") === "true";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(sent);
  const [isPending, startTransition] = useTransition();

  // Auto-verify if token is present
  useEffect(() => {
    if (token) {
      startTransition(async () => {
        const result = await verifyEmail(token);
        if (result.success) {
          setSuccess(true);
          setTimeout(() => router.push("/account"), 2000);
        } else {
          setError(result.error || "Verification failed");
        }
      });
    }
  }, [token, router]);

  const handleResend = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendSuccess(false);

    startTransition(async () => {
      const result = await resendVerificationEmail(email);
      if (result.success) {
        setResendSuccess(true);
      } else {
        setError(result.error || "Failed to resend email");
      }
    });
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm space-y-6 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
        >
          <CheckCircle className="size-8 text-green-600 dark:text-green-400" />
        </motion.div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Email verified!</h1>
          <p className="text-muted-foreground text-sm">
            Your email has been verified. Redirecting you to your account...
          </p>
        </div>
      </motion.div>
    );
  }

  if (token) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm space-y-6 text-center"
      >
        {isPending ? (
          <>
            <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Verifying your email...</p>
          </>
        ) : error ? (
          <>
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
              {error}
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Back to login
              </Button>
            </Link>
          </>
        ) : null}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-sm space-y-6"
    >
      <div className="space-y-2 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="size-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          {resendSuccess
            ? "We've sent you a verification link. Please check your inbox."
            : resend
            ? "Please enter your email to receive a new verification link."
            : "We've sent you a verification link. Please check your inbox."}
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3"
        >
          {error}
        </motion.div>
      )}

      {resendSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm rounded-lg p-3"
        >
          Verification email sent! Please check your inbox.
        </motion.div>
      )}

      {(resend || !sent) && (
        <form onSubmit={handleResend} className="space-y-4">
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

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Resend verification email"
            )}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Back to login
        </Link>
      </p>
    </motion.div>
  );
}
