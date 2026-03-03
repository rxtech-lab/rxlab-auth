"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, Shield } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateOAuthClient } from "@/actions/admin/clients/update";

interface SignInPermissionCardProps {
  clientId: string;
  initialPermission: "all" | "none" | "whitelist";
  onPermissionChange?: (permission: "all" | "none" | "whitelist") => void;
}

export function SignInPermissionCard({
  clientId,
  initialPermission,
  onPermissionChange,
}: SignInPermissionCardProps) {
  const [permission, setPermission] = useState<"all" | "none" | "whitelist">(
    initialPermission
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateOAuthClient(clientId, {
        signInPermission: permission,
      });

      if (result.success) {
        setSuccess(true);
        onPermissionChange?.(permission);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || "Failed to update sign-in permission");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Sign-in Permission
        </CardTitle>
        <CardDescription>
          Control who can sign in to your application via this OAuth client
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm rounded-lg p-3"
            >
              Sign-in permission saved successfully
            </motion.div>
          )}

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="radio"
                name="signInPermission"
                data-testid="sign-in-permission-all"
                value="all"
                checked={permission === "all"}
                onChange={() => setPermission("all")}
                disabled={isPending}
                className="mt-1"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">All Users</span>
                <p className="text-xs text-muted-foreground">
                  Any authenticated user can sign in via this client
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="radio"
                name="signInPermission"
                data-testid="sign-in-permission-none"
                value="none"
                checked={permission === "none"}
                onChange={() => setPermission("none")}
                disabled={isPending}
                className="mt-1"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">No Users</span>
                <p className="text-xs text-muted-foreground">
                  No user can sign in via this client (effectively disables the
                  client)
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="radio"
                name="signInPermission"
                data-testid="sign-in-permission-whitelist"
                value="whitelist"
                checked={permission === "whitelist"}
                onChange={() => setPermission("whitelist")}
                disabled={isPending}
                className="mt-1"
              />
              <div className="flex-1">
                <span className="text-sm font-medium">Whitelist Only</span>
                <p className="text-xs text-muted-foreground">
                  Only users with whitelisted emails can sign in via this client
                </p>
              </div>
            </label>
          </div>

          <Button
            type="submit"
            data-testid="save-sign-in-permission"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Permission"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
