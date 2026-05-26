"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Trash2, Smartphone } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addClientAppId,
  removeClientAppId,
} from "@/actions/admin/clients/app-ids";
import type { OAuthClientAppId } from "@/lib/db/schema";

interface ClientAppIdsCardProps {
  clientId: string;
  initialAppIds: OAuthClientAppId[];
}

export function ClientAppIdsCard({
  clientId,
  initialAppIds,
}: ClientAppIdsCardProps) {
  const [appIds, setAppIds] = useState(initialAppIds);
  const [newAppId, setNewAppId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAppId.trim();
    if (!trimmed) return;

    setError(null);

    startTransition(async () => {
      const result = await addClientAppId({ clientId, appId: trimmed });

      if (result.success && result.id) {
        setAppIds([
          {
            id: result.id,
            clientId,
            appId: trimmed,
            createdAt: new Date(),
          },
          ...appIds,
        ]);
        setNewAppId("");
      } else {
        setError(result.error || "Failed to add app ID");
      }
    });
  };

  const handleRemove = (id: string) => {
    setRemovingId(id);
    setError(null);

    startTransition(async () => {
      const result = await removeClientAppId(id, clientId);

      if (result.success) {
        setAppIds(appIds.filter((a) => a.id !== id));
      } else {
        setError(result.error || "Failed to remove app ID");
      }
      setRemovingId(null);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Apple App IDs
        </CardTitle>
        <CardDescription>
          Native Apple apps (iOS / macOS / watchOS) authorized to use passkeys
          for this client. Published in{" "}
          <code className="text-xs font-mono">
            /.well-known/apple-app-site-association
          </code>{" "}
          under <code className="text-xs font-mono">webcredentials.apps</code>.
          Format: <code className="text-xs font-mono">&lt;TEAMID&gt;.&lt;BUNDLEID&gt;</code>{" "}
          (e.g. <code className="text-xs font-mono">ABCDE12345.com.example.app</code>).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-destructive/10 text-destructive text-sm rounded-xl p-3 mb-4"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <Input
            type="text"
            placeholder="ABCDE12345.com.example.app"
            value={newAppId}
            onChange={(e) => setNewAppId(e.target.value)}
            disabled={isPending}
            data-testid="client-app-id-input"
            className="font-mono"
          />
          <Button
            type="submit"
            disabled={isPending || !newAppId.trim()}
            data-testid="add-client-app-id"
          >
            {isPending && !removingId ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </Button>
        </form>

        {appIds.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No Apple app IDs registered yet
          </p>
        ) : (
          <div className="space-y-2">
            {appIds.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted"
                data-testid={`client-app-id-${entry.appId}`}
              >
                <span className="text-sm font-mono">{entry.appId}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(entry.id)}
                  disabled={isPending}
                  data-testid={`remove-client-app-id-${entry.appId}`}
                >
                  {removingId === entry.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
