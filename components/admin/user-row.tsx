"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Mail,
  KeyRound,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteUser } from "@/actions/admin/users/delete";
import { adminResendVerificationEmail } from "@/actions/admin/users/resend-verification";
import { adminSendPasswordReset } from "@/actions/admin/users/send-password-reset";
import { toggleUserVerified } from "@/actions/admin/users/toggle-verified";
import type { User } from "@/lib/db/schema";

interface UserRowProps {
  user: User;
  onDeleted: () => void;
  onVerificationChanged?: (userId: string, verified: boolean) => void;
  onEdit?: () => void;
}

export function UserRow({
  user,
  onDeleted,
  onVerificationChanged,
  onEdit,
}: UserRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(user.emailVerified);

  const handleResendVerification = () => {
    if (
      !confirm(
        `Send verification email to "${user.email}"?\n\nThis will invalidate any existing verification link.`
      )
    )
      return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await adminResendVerificationEmail(user.id);
      if (result.success) {
        setSuccess("Verification email sent");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to send email");
      }
    });
  };

  const handleSendPasswordReset = () => {
    if (
      !confirm(
        `Send password reset email to "${user.email}"?\n\nThis will invalidate any existing reset link.`
      )
    )
      return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await adminSendPasswordReset(user.id);
      if (result.success) {
        setSuccess("Password reset email sent");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to send email");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;

    setError(null);

    startTransition(async () => {
      const result = await deleteUser(user.id);
      if (result.success) {
        onDeleted();
      } else {
        setError(result.error || "Failed to delete user");
      }
    });
  };

  const handleToggleVerified = () => {
    const action = isVerified ? "unverify" : "verify";
    if (
      !confirm(
        `${action === "verify" ? "Mark" : "Unmark"} "${user.email}" as verified?`
      )
    )
      return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await toggleUserVerified(user.id);
      if (result.success) {
        const newStatus = result.emailVerified ?? !isVerified;
        setIsVerified(newStatus);
        onVerificationChanged?.(user.id, newStatus);
        setSuccess(
          `User ${newStatus ? "marked as verified" : "unmarked as verified"}`
        );
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to update status");
      }
    });
  };

  return (
    <div
      className="hover:bg-muted/50 transition-colors"
      data-testid={`user-row-${user.id}`}
    >
      {(error || success) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={`text-sm px-4 py-2 ${error
              ? "bg-destructive/10 text-destructive"
              : "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
            }`}
        >
          {error || success}
        </motion.div>
      )}

      {/* Mobile layout */}
      <div className="sm:hidden p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{user.email}</div>
            {user.displayName && (
              <p className="text-sm text-muted-foreground truncate">
                {user.displayName}
              </p>
            )}
            {user.username && (
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isPending}
                  data-testid={`user-actions-${user.id}`}
                />
              }
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={onEdit}
                data-testid={`edit-user-${user.id}`}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit User
              </DropdownMenuItem>
              {!isVerified && (
                <DropdownMenuItem
                  onClick={handleResendVerification}
                  data-testid={`resend-verification-${user.id}`}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Verification
                </DropdownMenuItem>
              )}
              {isVerified && (
                <DropdownMenuItem
                  onClick={handleSendPasswordReset}
                  data-testid={`send-reset-${user.id}`}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Send Password Reset
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleToggleVerified}
                data-testid={
                  isVerified
                    ? `unmark-verified-${user.id}`
                    : `mark-verified-${user.id}`
                }
              >
                {isVerified ? (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Unmark Verified
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Verified
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                variant="destructive"
                data-testid={`delete-user-${user.id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-3">
          {isVerified ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Unverified
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {user.createdAt.toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_120px_100px_50px] gap-4 px-4 py-3 items-center">
        {/* User info */}
        <div className="min-w-0">
          <div className="font-medium truncate">{user.email}</div>
          {user.displayName && (
            <p className="text-sm text-muted-foreground truncate">
              {user.displayName}
            </p>
          )}
          {user.username && (
            <p className="text-xs text-muted-foreground">@{user.username}</p>
          )}
        </div>

        {/* Status badge */}
        <div>
          {isVerified ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Unverified
            </Badge>
          )}
        </div>

        {/* Created date */}
        <div className="text-sm text-muted-foreground">
          {user.createdAt.toLocaleDateString()}
        </div>

        {/* Actions dropdown */}
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  data-testid={`user-actions-${user.id}`}
                />
              }
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={onEdit}
                data-testid={`edit-user-${user.id}`}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit User
              </DropdownMenuItem>
              {!isVerified && (
                <DropdownMenuItem
                  onClick={handleResendVerification}
                  data-testid={`resend-verification-${user.id}`}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Verification
                </DropdownMenuItem>
              )}
              {isVerified && (
                <DropdownMenuItem
                  onClick={handleSendPasswordReset}
                  data-testid={`send-reset-${user.id}`}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Send Password Reset
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleToggleVerified}
                data-testid={
                  isVerified
                    ? `unmark-verified-${user.id}`
                    : `mark-verified-${user.id}`
                }
              >
                {isVerified ? (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Unmark Verified
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Verified
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                variant="destructive"
                data-testid={`delete-user-${user.id}`}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
