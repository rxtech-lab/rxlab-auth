"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePasskey } from "@/hooks/use-passkey";

export function PasskeySetupPrompt() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { isLoading, error, registerPasskey, clearError } = usePasskey({
    onSuccess: () => {
      setIsOpen(false);
      router.replace("/account");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await registerPasskey(name.trim());
  };

  const handleSkip = useCallback(() => {
    if (isLoading) return;
    setIsOpen(false);
    clearError();
    router.replace("/account");
  }, [clearError, router, isLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        handleSkip();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, handleSkip]);

  // Focus the passkey name input when the dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleSkip}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="passkey-setup-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-background border rounded-lg p-6 z-50 shadow-lg"
            data-testid="passkey-setup-prompt"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 id="passkey-setup-title" className="font-semibold">Secure your account</h2>
                <p className="text-sm text-muted-foreground">
                  Add a passkey for faster, more secure sign-in
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-passkey-name">Passkey Name</Label>
                <Input
                  ref={inputRef}
                  id="setup-passkey-name"
                  placeholder="e.g., MacBook Pro, iPhone"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  data-testid="setup-passkey-name"
                />
                <p className="text-xs text-muted-foreground">
                  Give your passkey a name to identify it later
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleSkip}
                  disabled={isLoading}
                  data-testid="skip-passkey-setup"
                >
                  Skip for now
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isLoading || !name.trim()}
                  data-testid="register-passkey-setup"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Add Passkey
                    </>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
