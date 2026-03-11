"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, User, LogOut } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { switchAccount } from "@/actions/oauth/account-select";

interface AccountSelectCardProps {
  email: string;
  client: {
    name: string;
    iconUrl: string | null;
  };
  oauthParams: Record<string, string>;
}

export function AccountSelectCard({
  email,
  client,
  oauthParams,
}: AccountSelectCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleContinue = () => {
    startTransition(() => {
      const params = new URLSearchParams(oauthParams);
      params.set("account_confirmed", "true");
      router.push(`/api/oauth/authorize?${params.toString()}`);
    });
  };

  const handleSwitchAccount = () => {
    setIsSwitching(true);
    startTransition(async () => {
      await switchAccount(oauthParams);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full max-w-md"
    >
      <Card>
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Choose an account</h1>
            <p className="text-[15px] text-muted-foreground">
              to continue to {client.name}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <button
            onClick={handleContinue}
            disabled={isPending}
            data-testid="continue-as-current"
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{email}</p>
              <p className="text-xs text-muted-foreground">
                Continue with this account
              </p>
            </div>
            {isPending && !isSwitching && (
              <Loader2 className="w-4 h-4 animate-spin ml-auto shrink-0" />
            )}
          </button>

          <button
            onClick={handleSwitchAccount}
            disabled={isPending}
            data-testid="use-different-account"
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <LogOut className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Use a different account</p>
              <p className="text-xs text-muted-foreground">
                Sign out and sign in with another account
              </p>
            </div>
            {isSwitching && (
              <Loader2 className="w-4 h-4 animate-spin ml-auto shrink-0" />
            )}
          </button>
        </CardContent>

        <CardFooter />
      </Card>
    </motion.div>
  );
}
