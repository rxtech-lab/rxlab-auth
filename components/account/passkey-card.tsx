"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  KeyRound,
  Smartphone,
  UsbIcon,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renamePasskey, deletePasskey } from "@/actions/passkeys/manage";

interface PasskeyCardProps {
  passkey: {
    id: string;
    name: string;
    deviceType: string | null;
    backedUp: boolean | null;
    createdAt: Date;
    lastUsedAt: Date | null;
  };
}

export function PasskeyCard({ passkey }: PasskeyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(passkey.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRename = () => {
    if (name === passkey.name) {
      setIsEditing(false);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await renamePasskey(passkey.id, name);
      if (result.success) {
        setIsEditing(false);
      } else {
        setError(result.error || "Failed to rename");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this passkey?")) return;

    setError(null);
    startTransition(async () => {
      const result = await deletePasskey(passkey.id);
      if (!result.success) {
        setError(result.error || "Failed to delete");
      }
    });
  };

  const isPlatform = passkey.deviceType === "platform";

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
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            {isPlatform ? (
              <Smartphone className="w-5 h-5 text-primary" />
            ) : (
              <UsbIcon className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 w-40"
                  disabled={isPending}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleRename}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setName(passkey.name);
                  }}
                  disabled={isPending}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-medium">{passkey.name}</p>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{isPlatform ? "Platform" : "Security Key"}</span>
              {passkey.backedUp && (
                <>
                  <span>•</span>
                  <span className="text-green-600 dark:text-green-400">
                    Synced
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <Button
          size="icon-sm"
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Added {passkey.createdAt.toLocaleDateString()}</span>
        {passkey.lastUsedAt && (
          <>
            <span>•</span>
            <span>Last used {passkey.lastUsedAt.toLocaleDateString()}</span>
          </>
        )}
      </div>
    </motion.div>
  );
}
