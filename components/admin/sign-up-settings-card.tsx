"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, UserPlus } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateSignUpSettings } from "@/actions/admin/settings/update";

interface SignUpSettingsCardProps {
  initialSettings: {
    signUpEnabled: boolean;
    signUpWhitelistEnabled: boolean;
  };
}

export function SignUpSettingsCard({
  initialSettings,
}: SignUpSettingsCardProps) {
  const [signUpEnabled, setSignUpEnabled] = useState(
    initialSettings.signUpEnabled
  );
  const [whitelistEnabled, setWhitelistEnabled] = useState(
    initialSettings.signUpWhitelistEnabled
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateSignUpSettings({
        signUpEnabled,
        signUpWhitelistEnabled: whitelistEnabled,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to update settings");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Sign-up Settings
        </CardTitle>
        <CardDescription>
          Control who can register for new accounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm rounded-lg p-3"
            >
              Settings saved successfully
            </motion.div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="signUpEnabled">Enable Public Sign-up</Label>
                <p className="text-sm text-muted-foreground">
                  Allow anyone to create accounts (disable to restrict to
                  whitelist only)
                </p>
              </div>
              <Switch
                id="signUpEnabled"
                data-testid="sign-up-enabled"
                checked={signUpEnabled}
                onCheckedChange={setSignUpEnabled}
                disabled={isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="whitelistEnabled">Enable Email Whitelist</Label>
                <p className="text-sm text-muted-foreground">
                  Whitelisted emails can always sign up, even when public
                  sign-up is disabled
                </p>
              </div>
              <Switch
                id="whitelistEnabled"
                data-testid="whitelist-enabled"
                checked={whitelistEnabled}
                onCheckedChange={setWhitelistEnabled}
                disabled={isPending}
              />
            </div>
          </div>

          <Button type="submit" data-testid="save-settings" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
