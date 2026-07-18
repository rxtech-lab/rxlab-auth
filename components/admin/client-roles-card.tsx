"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Save, Shield, Star, Trash2, X } from "lucide-react";
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
  createClientRole,
  deleteClientRole,
  setClientDefaultRole,
  updateClientRole,
} from "@/actions/admin/clients/roles";
import type { OAuthClientRole } from "@/lib/db/schema";

interface ClientRolesCardProps {
  clientId: string;
  initialRoles: OAuthClientRole[];
  initialDefaultRoleId: string | null;
}

export function ClientRolesCard({
  clientId,
  initialRoles,
  initialDefaultRoleId,
}: ClientRolesCardProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [defaultRoleId, setDefaultRoleId] = useState(initialDefaultRoleId);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      initialRoles.map((role) => [
        role.id,
        {
          key: role.key,
          name: role.name,
        },
      ])
    )
  );
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const key = newKey.trim().toLowerCase();
    const name = newName.trim();
    if (!key || !name) return;

    setError(null);
    startTransition(async () => {
      const result = await createClientRole({ clientId, key, name });
      if (result.success && result.role) {
        setRoles([...roles, result.role].sort((a, b) => a.name.localeCompare(b.name)));
        setDrafts({
          ...drafts,
          [result.role.id]: { key: result.role.key, name: result.role.name },
        });
        setNewKey("");
        setNewName("");
      } else {
        setError(result.error || "Failed to create role");
      }
    });
  };

  const handleSave = (role: OAuthClientRole) => {
    const draft = drafts[role.id];
    if (!draft) return;

    setError(null);
    setPendingRoleId(role.id);
    startTransition(async () => {
      const result = await updateClientRole({
        roleId: role.id,
        clientId,
        key: draft.key.trim().toLowerCase(),
        name: draft.name.trim(),
      });

      if (result.success && result.role) {
        setRoles(
          roles
            .map((existing) =>
              existing.id === result.role!.id ? result.role! : existing
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setDrafts({
          ...drafts,
          [result.role.id]: {
            key: result.role.key,
            name: result.role.name,
          },
        });
      } else {
        setError(result.error || "Failed to update role");
      }
      setPendingRoleId(null);
    });
  };

  const handleDelete = (role: OAuthClientRole) => {
    if (!confirm(`Delete role "${role.name}"? This removes it from assigned users.`)) {
      return;
    }

    setError(null);
    setPendingRoleId(role.id);
    startTransition(async () => {
      const result = await deleteClientRole(role.id, clientId);
      if (result.success) {
        setRoles(roles.filter((existing) => existing.id !== role.id));
        if (defaultRoleId === role.id) {
          setDefaultRoleId(null);
        }
        const nextDrafts = { ...drafts };
        delete nextDrafts[role.id];
        setDrafts(nextDrafts);
      } else {
        setError(result.error || "Failed to delete role");
      }
      setPendingRoleId(null);
    });
  };

  const handleSetDefault = (roleId: string | null) => {
    setError(null);
    setPendingRoleId(roleId ?? "clear-default");
    startTransition(async () => {
      const result = await setClientDefaultRole({ clientId, roleId });
      if (result.success) {
        setDefaultRoleId(roleId);
      } else {
        setError(result.error || "Failed to set default role");
      }
      setPendingRoleId(null);
    });
  };

  const isCreating = isPending && pendingRoleId === null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          App Roles
        </CardTitle>
        <CardDescription>
          Define roles for this app. Users can be assigned these roles from the
          user management page. New users receive only the explicitly selected
          default role; if none is selected, no role is assigned.
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

        <form onSubmit={handleCreate} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] mb-4">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Admin"
            disabled={isPending}
            data-testid="new-client-role-name"
          />
          <Input
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="admin"
            disabled={isPending}
            data-testid="new-client-role-key"
            className="font-mono"
          />
          <Button
            type="submit"
            disabled={isPending || !newName.trim() || !newKey.trim()}
            data-testid="add-client-role"
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add
          </Button>
        </form>

        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No roles configured yet
          </p>
        ) : (
          <div className="space-y-2">
            {defaultRoleId && (
              <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">Default role</p>
                  <p className="text-xs text-muted-foreground">
                    Applied when this OAuth client creates a new user.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSetDefault(null)}
                  disabled={isPending}
                  data-testid="clear-default-client-role"
                >
                  {pendingRoleId === "clear-default" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                  Clear
                </Button>
              </div>
            )}
            {roles.map((role) => {
              const draft = drafts[role.id] ?? {
                key: role.key,
                name: role.name,
              };
              const hasChanges =
                draft.key !== role.key || draft.name !== role.name;
              const isRolePending = pendingRoleId === role.id;

              return (
                <div
                  key={role.id}
                  className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto] p-3 rounded-xl bg-muted"
                  data-testid={`client-role-${role.key}`}
                >
                  <Input
                    value={draft.name}
                    onChange={(event) =>
                      setDrafts({
                        ...drafts,
                        [role.id]: { ...draft, name: event.target.value },
                      })
                    }
                    disabled={isPending}
                    data-testid={`client-role-name-${role.key}`}
                  />
                  <Input
                    value={draft.key}
                    onChange={(event) =>
                      setDrafts({
                        ...drafts,
                        [role.id]: { ...draft, key: event.target.value },
                      })
                    }
                    disabled={isPending}
                    data-testid={`client-role-key-${role.key}`}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant={defaultRoleId === role.id ? "default" : "outline"}
                    onClick={() => handleSetDefault(role.id)}
                    disabled={isPending || defaultRoleId === role.id}
                    data-testid={`set-default-client-role-${role.key}`}
                  >
                    {isRolePending && defaultRoleId !== role.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Star className="size-4" />
                    )}
                    {defaultRoleId === role.id ? "Default" : "Set default"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSave(role)}
                    disabled={isPending || !hasChanges}
                    data-testid={`save-client-role-${role.key}`}
                  >
                    {isRolePending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(role)}
                    disabled={isPending}
                    data-testid={`delete-client-role-${role.key}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
