"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revertAccountDeletion } from "@/actions/account/delete-account";

interface PendingDeletionBannerProps {
  /** ISO-8601 UTC instant the account will be deleted. */
  deletionScheduledAt: string;
}

/**
 * Shown for the whole grace period. Without this the only way to revert is an
 * API call, which is not a reasonable ask of someone who clicked delete by
 * mistake — the recovery path has to be as visible as the damage.
 */
export function PendingDeletionBanner({
  deletionScheduledAt,
}: PendingDeletionBannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Rendered client-side so the date lands in the viewer's timezone rather than
  // the server's.
  const scheduled = new Date(deletionScheduledAt);
  const formatted = scheduled.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  const handleRevert = () => {
    setError(null);
    startTransition(async () => {
      const result = await revertAccountDeletion();
      if (!result.success) {
        setError(result.error || "Failed to cancel deletion");
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-destructive/30 bg-destructive/10 p-4"
      data-testid="pending-deletion-banner"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-destructive" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-destructive">
            This account is scheduled for deletion
          </p>
          <p className="text-xs text-muted-foreground">
            Everything will be permanently deleted on{" "}
            <time dateTime={deletionScheduledAt} data-testid="deletion-scheduled-at">
              {formatted}
            </time>
            . You can still change your mind until then.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleRevert}
          disabled={isPending}
          data-testid="cancel-account-deletion"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Cancelling...
            </>
          ) : (
            "Keep my account"
          )}
        </Button>
      </div>
    </motion.div>
  );
}
