"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Trash2, Mail } from "lucide-react";
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
  addClientWhitelistEmail,
  removeClientWhitelistEmail,
} from "@/actions/admin/clients/whitelist";
import type { OAuthClientEmailWhitelist } from "@/lib/db/schema";

interface ClientEmailWhitelistCardProps {
  clientId: string;
  initialEmails: OAuthClientEmailWhitelist[];
  whitelistEnabled: boolean;
}

export function ClientEmailWhitelistCard({
  clientId,
  initialEmails,
  whitelistEnabled,
}: ClientEmailWhitelistCardProps) {
  const [emails, setEmails] = useState(initialEmails);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setError(null);

    startTransition(async () => {
      const result = await addClientWhitelistEmail({
        email: newEmail,
        clientId,
      });

      if (result.success && result.id) {
        setEmails([
          {
            id: result.id,
            clientId,
            email: newEmail.toLowerCase(),
            createdAt: new Date(),
          },
          ...emails,
        ]);
        setNewEmail("");
      } else {
        setError(result.error || "Failed to add email");
      }
    });
  };

  const handleRemove = (id: string) => {
    setRemovingId(id);
    setError(null);

    startTransition(async () => {
      const result = await removeClientWhitelistEmail(id, clientId);

      if (result.success) {
        setEmails(emails.filter((e) => e.id !== id));
      } else {
        setError(result.error || "Failed to remove email");
      }
      setRemovingId(null);
    });
  };

  return (
    <Card className={!whitelistEnabled ? "opacity-60" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Client Sign-in Whitelist
        </CardTitle>
        <CardDescription>
          {whitelistEnabled
            ? "Only these emails can sign in via this OAuth client"
            : 'Set sign-in permission to "Whitelist Only" to manage allowed emails'}
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
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={isPending || !whitelistEnabled}
            data-testid="client-whitelist-email-input"
          />
          <Button
            type="submit"
            disabled={isPending || !whitelistEnabled || !newEmail.trim()}
            data-testid="add-client-whitelist-email"
          >
            {isPending && !removingId ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </Button>
        </form>

        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No emails whitelisted yet
          </p>
        ) : (
          <div className="space-y-2">
            {emails.map((email) => (
              <div
                key={email.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted"
                data-testid={`client-whitelist-email-${email.email}`}
              >
                <span className="text-sm font-mono">{email.email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(email.id)}
                  disabled={isPending || !whitelistEnabled}
                  data-testid={`remove-client-whitelist-${email.email}`}
                >
                  {removingId === email.id ? (
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
