"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, Shield, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revokeApp } from "@/actions/account/revoke-app";

interface ConnectedAppCardProps {
  consent: {
    id: string;
    clientId: string;
    scopes: string[];
    createdAt: Date;
    client: {
      name: string;
      description: string | null;
      iconUrl: string | null;
    };
  };
}

const SCOPE_LABELS: Record<string, string> = {
  openid: "Identity",
  profile: "Profile",
  email: "Email",
  offline_access: "Offline Access",
};

export function ConnectedAppCard({ consent }: ConnectedAppCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRevoke = () => {
    if (
      !confirm(
        `Are you sure you want to revoke access for ${consent.client.name}?`
      )
    )
      return;

    setError(null);
    startTransition(async () => {
      const result = await revokeApp(consent.clientId);
      if (!result.success) {
        setError(result.error || "Failed to revoke access");
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-lg p-4 space-y-3"
    >
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded p-2">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {consent.client.iconUrl ? (
            <img
              src={consent.client.iconUrl}
              alt={consent.client.name}
              className="w-12 h-12 rounded-lg"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <p className="font-medium">{consent.client.name}</p>
            {consent.client.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {consent.client.description}
              </p>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant="destructive"
          onClick={handleRevoke}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Revoking...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              Revoke
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Permissions granted:
        </p>
        <div className="flex flex-wrap gap-1">
          {consent.scopes.map((scope) => (
            <span
              key={scope}
              className="px-2 py-0.5 text-xs rounded-full bg-muted"
            >
              {SCOPE_LABELS[scope] || scope}
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Connected {consent.createdAt.toLocaleDateString()}
      </p>
    </motion.div>
  );
}
