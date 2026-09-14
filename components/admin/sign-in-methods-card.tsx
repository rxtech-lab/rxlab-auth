"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { KeyRound, Loader2, Lock, ToggleLeft } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { updateOAuthClient } from "@/actions/admin/clients/update";
import {
  SOCIAL_PROVIDER_IDS,
  type SocialProviderId,
} from "@/lib/auth/social/providers";
import type { ClientSignInMethods } from "@/lib/auth/sign-in-methods";

const PROVIDER_LABELS: Record<SocialProviderId, string> = {
  github: "GitHub",
  google: "Google",
  apple: "Apple",
};

interface SignInMethodsCardProps {
  clientId: string;
  initialMethods: ClientSignInMethods;
  /**
   * Providers with server-wide credentials configured. A provider missing here
   * cannot be used by any client no matter what this card says, so its row is
   * shown disabled rather than hidden — otherwise an admin toggling it on and
   * seeing nothing happen has no way to find out why.
   */
  configuredProviders: SocialProviderId[];
}

export function SignInMethodsCard({
  clientId,
  initialMethods,
  configuredProviders,
}: SignInMethodsCardProps) {
  const [methods, setMethods] = useState<ClientSignInMethods>(initialMethods);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const setSocial = (provider: SocialProviderId, enabled: boolean) => {
    setMethods((current) => ({
      ...current,
      social: { ...current.social, [provider]: enabled },
    }));
  };

  const nothingEnabled =
    !methods.password &&
    !methods.passkey &&
    configuredProviders.every((id) => !methods.social[id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateOAuthClient(clientId, {
        signInMethods: methods,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to update sign-in methods");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ToggleLeft className="h-5 w-5" />
          Sign-in Methods
        </CardTitle>
        <CardDescription>
          Choose which ways users may sign in to this client. Everything is
          enabled by default; turning a method off hides it from the client and
          rejects it server-side.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-destructive/10 text-destructive text-sm rounded-xl p-3"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-500/10 text-green-600 dark:text-green-400 text-sm rounded-xl p-3"
            >
              Sign-in methods saved successfully
            </motion.div>
          )}

          {nothingEnabled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm rounded-xl p-3"
              data-testid="sign-in-methods-empty-warning"
            >
              No sign-in method is enabled — nobody will be able to sign in to
              this client.
            </motion.div>
          )}

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
              <Lock className="size-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <span className="text-sm font-medium">Email &amp; password</span>
                <p className="text-xs text-muted-foreground">
                  Password sign-in and the native password grant
                </p>
              </div>
              <Switch
                data-testid="sign-in-method-password"
                checked={methods.password}
                onCheckedChange={(checked) =>
                  setMethods((current) => ({ ...current, password: checked }))
                }
                disabled={isPending}
              />
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
              <KeyRound className="size-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <span className="text-sm font-medium">Passkey</span>
                <p className="text-xs text-muted-foreground">
                  WebAuthn sign-in, registration and the system account sheet
                </p>
              </div>
              <Switch
                data-testid="sign-in-method-passkey"
                checked={methods.passkey}
                onCheckedChange={(checked) =>
                  setMethods((current) => ({ ...current, passkey: checked }))
                }
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Social providers</p>
            {SOCIAL_PROVIDER_IDS.map((provider) => {
              const configured = configuredProviders.includes(provider);
              return (
                <div
                  key={provider}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/50"
                >
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      {PROVIDER_LABELS[provider]}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {configured
                        ? `Continue with ${PROVIDER_LABELS[provider]}`
                        : "Not configured on this server"}
                    </p>
                  </div>
                  <Switch
                    data-testid={`sign-in-method-social-${provider}`}
                    checked={configured && methods.social[provider]}
                    onCheckedChange={(checked) => setSocial(provider, checked)}
                    disabled={isPending || !configured}
                  />
                </div>
              );
            })}
          </div>

          <Button
            type="submit"
            data-testid="save-sign-in-methods"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Methods"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
