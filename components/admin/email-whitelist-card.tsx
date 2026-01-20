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
  addWhitelistEmail,
  removeWhitelistEmail,
} from "@/actions/admin/settings/whitelist";
import type { EmailWhitelist } from "@/lib/db/schema";

interface EmailWhitelistCardProps {
  initialEmails: EmailWhitelist[];
  whitelistEnabled: boolean;
}

export function EmailWhitelistCard({
  initialEmails,
  whitelistEnabled,
}: EmailWhitelistCardProps) {
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
      const result = await addWhitelistEmail({ email: newEmail });

      if (result.success) {
        // Add to list with a temporary ID (will be replaced on next server render)
        setEmails([
          {
            id: crypto.randomUUID(),
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
      const result = await removeWhitelistEmail(id);

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
          Email Whitelist
        </CardTitle>
        <CardDescription>
          {whitelistEnabled
            ? "These emails can always sign up, even when public sign-up is disabled"
            : "Enable whitelist above to allow specific emails to sign up"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 mb-4"
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
            data-testid="whitelist-email-input"
          />
          <Button
            type="submit"
            disabled={isPending || !whitelistEnabled || !newEmail.trim()}
            data-testid="add-whitelist-email"
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
                className="flex items-center justify-between p-3 rounded-lg bg-muted"
                data-testid={`whitelist-email-${email.email}`}
              >
                <span className="text-sm font-mono">{email.email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(email.id)}
                  disabled={isPending || !whitelistEnabled}
                  data-testid={`remove-whitelist-${email.email}`}
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
