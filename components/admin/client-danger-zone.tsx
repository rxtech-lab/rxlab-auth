"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, RefreshCw, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { regenerateClientSecret } from "@/actions/admin/clients/update";
import { deleteOAuthClient } from "@/actions/admin/clients/delete";

interface ClientDangerZoneProps {
  clientId: string;
  clientName: string;
}

export function ClientDangerZone({ clientId, clientName }: ClientDangerZoneProps) {
  const router = useRouter();
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleRegenerateSecret = () => {
    if (
      !confirm(
        "Are you sure you want to regenerate the client secret? The old secret will stop working immediately."
      )
    )
      return;

    setError(null);
    setNewSecret(null);

    startTransition(async () => {
      const result = await regenerateClientSecret(clientId);
      if (result.success && result.newSecret) {
        setNewSecret(result.newSecret);
      } else {
        setError(result.error || "Failed to regenerate secret");
      }
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        `Are you sure you want to delete "${clientName}"? This action cannot be undone. All users will lose access to this application.`
      )
    )
      return;

    setError(null);

    startTransition(async () => {
      const result = await deleteOAuthClient(clientId);
      if (result.success) {
        router.push("/admin/dashboard/clients");
      } else {
        setError(result.error || "Failed to delete client");
      }
    });
  };

  const handleCopy = () => {
    if (newSecret) {
      navigator.clipboard.writeText(newSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="ring-1 ring-destructive/20">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible and destructive actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-destructive/10 text-destructive text-sm rounded-xl p-3"
          >
            {error}
          </motion.div>
        )}

        {newSecret && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-500/10 rounded-xl p-4"
          >
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
              New Client Secret Generated
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mb-3">
              Save this secret now. It will not be shown again.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 p-2.5 bg-white dark:bg-black/20 rounded-lg text-xs font-mono break-all">
                {newSecret}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleRegenerateSecret}
            disabled={isPending}
            className="border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Regenerate Secret
          </Button>

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete Application
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
