"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User as UserIcon, AtSign } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createUser } from "@/actions/admin/users/create";
import { updateUser } from "@/actions/admin/users/update";
import type { User } from "@/lib/db/schema";

interface UserSheetProps {
  mode: "create" | "edit";
  user?: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (user?: User) => void;
}

interface UserFormProps {
  mode: "create" | "edit";
  user?: User;
  onSuccess?: (user?: User) => void;
  onOpenChange: (open: boolean) => void;
}

function UserForm({ mode, user, onSuccess, onOpenChange }: UserFormProps) {
  const [email, setEmail] = useState(
    mode === "edit" && user ? user.email : ""
  );
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(
    mode === "edit" && user ? user.displayName || "" : ""
  );
  const [username, setUsername] = useState(
    mode === "edit" && user ? user.username || "" : ""
  );
  const [emailVerified, setEmailVerified] = useState<boolean>(
    mode === "edit" && user ? (user.emailVerified ?? false) : false
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      if (mode === "create") {
        const result = await createUser({
          email,
          password,
          displayName: displayName || undefined,
          username: username || null,
          emailVerified,
        });

        if (result.success) {
          onOpenChange(false);
          onSuccess?.();
        } else {
          setError(result.error || "Failed to create user");
        }
      } else if (user) {
        const result = await updateUser(user.id, {
          email: email !== user.email ? email : undefined,
          password: password || null,
          displayName: displayName || null,
          username: username || null,
          emailVerified,
        });

        if (result.success) {
          onOpenChange(false);
          onSuccess?.(result.user);
        } else {
          setError(result.error || "Failed to update user");
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
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
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isPending}
            className="pl-10"
            data-testid="user-email-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">
          Password{mode === "edit" && " (leave empty to keep current)"}
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder={
              mode === "create"
                ? "At least 8 characters"
                : "New password (optional)"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={mode === "create"}
            minLength={mode === "create" ? 8 : undefined}
            disabled={isPending}
            className="pl-10"
            data-testid="user-password-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="displayName"
            type="text"
            placeholder="John Doe"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isPending}
            className="pl-10"
            data-testid="user-displayname-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="username"
            type="text"
            placeholder="johndoe"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isPending}
            className="pl-10"
            data-testid="user-username-input"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Letters, numbers, and underscores only
        </p>
      </div>

      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <Label htmlFor="emailVerified">Email Verified</Label>
          <p className="text-sm text-muted-foreground">
            Mark this user&apos;s email as verified
          </p>
        </div>
        <Switch
          id="emailVerified"
          checked={emailVerified}
          onCheckedChange={setEmailVerified}
          disabled={isPending}
          data-testid="user-verified-toggle"
        />
      </div>

      <SheetFooter className="p-0 mt-4">
        <Button
          type="submit"
          disabled={isPending}
          data-testid="user-submit-button"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {mode === "create" ? "Creating..." : "Saving..."}
            </>
          ) : mode === "create" ? (
            "Create User"
          ) : (
            "Save Changes"
          )}
        </Button>
      </SheetFooter>
    </form>
  );
}

export function UserSheet({
  mode,
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserSheetProps) {
  // Use key to reset form state when mode or user changes
  const formKey = mode === "edit" && user ? `edit-${user.id}` : "create";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="user-sheet">
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? "Create User" : "Edit User"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Add a new user to the system"
              : "Update user information"}
          </SheetDescription>
        </SheetHeader>

        {open && (
          <UserForm
            key={formKey}
            mode={mode}
            user={user}
            onSuccess={onSuccess}
            onOpenChange={onOpenChange}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
