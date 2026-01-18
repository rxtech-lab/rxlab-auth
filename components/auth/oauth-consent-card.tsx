"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { approveConsent, denyConsent, type ConsentParams } from "@/actions/oauth/consent";
import { getScope } from "@/lib/scopes";

interface OAuthConsentCardProps {
  client: {
    id: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
  };
  scopes: string[];
  params: ConsentParams;
}

export function OAuthConsentCard({ client, scopes, params }: OAuthConsentCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDenying, setIsDenying] = useState(false);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveConsent(params);
      if (result.success && result.redirectUrl) {
        router.push(result.redirectUrl);
      } else {
        setError(result.error || "Failed to approve");
      }
    });
  };

  const handleDeny = () => {
    setIsDenying(true);
    startTransition(async () => {
      await denyConsent(params.redirectUri, params.state);
    });
  };

  const isLoading = isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md"
    >
      <Card>
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            {client.iconUrl ? (
              <img
                src={client.iconUrl}
                alt={client.name}
                className="w-16 h-16 rounded-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              wants to access your account
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">This will allow {client.name} to:</p>
            <ul className="space-y-2">
              {scopes.map((scope) => {
                const scopeInfo = getScope(scope);
                if (!scopeInfo) return null;
                const Icon = scopeInfo.icon;
                return (
                  <motion.li
                    key={scope}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{scopeInfo.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {scopeInfo.subtitle}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>

          {client.description && (
            <p className="text-xs text-muted-foreground border-t pt-4">
              {client.description}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDeny}
            disabled={isLoading}
          >
            {isDenying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Denying...
              </>
            ) : (
              "Deny"
            )}
          </Button>
          <Button
            className="flex-1"
            onClick={handleApprove}
            disabled={isLoading}
          >
            {isPending && !isDenying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Allowing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Allow
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <p className="text-center text-xs text-muted-foreground mt-4">
        By clicking Allow, you authorize this application to access your information.
      </p>
    </motion.div>
  );
}
