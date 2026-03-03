"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/actions/account/update-profile";

interface ProfileFormProps {
  user: {
    email: string;
    username: string | null;
    displayName: string | null;
    avatarSeed: string | null;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [username, setUsername] = useState(user.username || "");
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateProfile({
        username: username || undefined,
        displayName: displayName || undefined,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to update profile");
      }
    });
  };

  return (
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
          Profile updated successfully!
        </motion.div>
      )}

      <div className="flex items-center gap-5">
        <img
          src={`/api/avatar/${user.avatarSeed || user.email}`}
          alt="Avatar"
          className="w-24 h-24 rounded-full"
        />
        <div>
          <p className="text-sm text-muted-foreground">
            Your avatar is automatically generated
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={user.email}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          type="text"
          placeholder="Your display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Letters, numbers, underscores, and hyphens only
        </p>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="size-4" />
            Save Changes
          </>
        )}
      </Button>
    </form>
  );
}
