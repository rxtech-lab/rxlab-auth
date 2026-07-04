"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUserRoleAssignments } from "@/actions/admin/users/roles";
import { Label } from "@/components/ui/label";

export interface UserRoleOption {
  id: string;
  key: string;
  name: string;
}

export interface UserRoleOptionApp {
  id: string;
  name: string;
  roles: UserRoleOption[];
}

export interface UserRoleAssignmentValue {
  clientId: string;
  roleIds: string[];
}

interface UserRoleAssignmentsProps {
  userId: string;
  apps: UserRoleOptionApp[];
  disabled?: boolean;
  onChange: (assignments: UserRoleAssignmentValue[]) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function UserRoleAssignments({
  userId,
  apps,
  disabled = false,
  onChange,
  onLoadingChange,
}: UserRoleAssignmentsProps) {
  const [rows, setRows] = useState<
    { id: string; clientId: string; roleId: string }[]
  >([{ id: crypto.randomUUID(), clientId: "", roleId: "" }]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const appsWithRoles = useMemo(
    () => apps.filter((app) => app.roles.length > 0),
    [apps]
  );

  const emitChange = useCallback(
    (nextRows: { id: string; clientId: string; roleId: string }[]) => {
      const grouped = new Map<string, string[]>();
      for (const row of nextRows) {
        if (!row.clientId || !row.roleId) continue;
        const roleIds = grouped.get(row.clientId) ?? [];
        if (!roleIds.includes(row.roleId)) {
          roleIds.push(row.roleId);
        }
        grouped.set(row.clientId, roleIds);
      }

      onChange(
        Array.from(grouped.entries()).map(([clientId, roleIds]) => ({
          clientId,
          roleIds,
        }))
      );
    },
    [onChange]
  );

  useEffect(() => {
    let cancelled = false;

    getUserRoleAssignments(userId).then((result) => {
      if (cancelled) return;

      if (result.success && result.data) {
        const loadedRows = result.data.flatMap((assignment) =>
          assignment.roleIds.map((roleId) => ({
            id: crypto.randomUUID(),
            clientId: assignment.clientId,
            roleId,
          }))
        );
        const nextRows =
          loadedRows.length > 0
            ? loadedRows
            : [{ id: crypto.randomUUID(), clientId: "", roleId: "" }];
        setRows(nextRows);
        emitChange(nextRows);
      } else {
        setError(result.error || "Failed to load user roles");
      }
      setIsLoading(false);
      onLoadingChange?.(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, emitChange, onLoadingChange]);

  const setNextRows = (
    nextRows: { id: string; clientId: string; roleId: string }[]
  ) => {
    setRows(nextRows);
    emitChange(nextRows);
  };

  const handleClientChange = (rowId: string, clientId: string) => {
    const app = appsWithRoles.find((candidate) => candidate.id === clientId);
    const nextRows = rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            clientId,
            roleId: app?.roles.some((role) => role.id === row.roleId)
              ? row.roleId
              : "",
          }
        : row
    );
    setNextRows(nextRows);
  };

  const handleRoleChange = (rowId: string, roleId: string) => {
    setNextRows(
      rows.map((row) => (row.id === rowId ? { ...row, roleId } : row))
    );
  };

  const addRow = () => {
    setNextRows([
      ...rows,
      { id: crypto.randomUUID(), clientId: "", roleId: "" },
    ]);
  };

  const removeRow = (rowId: string) => {
    const nextRows = rows.filter((row) => row.id !== rowId);
    setNextRows(
      nextRows.length > 0
        ? nextRows
        : [{ id: crypto.randomUUID(), clientId: "", roleId: "" }]
    );
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">App Roles</h3>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3"
        >
          {error}
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="size-4 animate-spin" />
          Loading roles
        </div>
      ) : appsWithRoles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No app roles are configured yet.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const selectedApp = appsWithRoles.find(
              (app) => app.id === row.clientId
            );

            return (
              <div
                key={row.id}
                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <div className="space-y-2">
                  <Label htmlFor={`app-role-client-${row.id}`}>App</Label>
                  <select
                    id={`app-role-client-${row.id}`}
                    value={row.clientId}
                    onChange={(event) =>
                      handleClientChange(row.id, event.target.value)
                    }
                    disabled={disabled}
                    data-testid={`user-role-app-${row.id}`}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Select app</option>
                    {appsWithRoles.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`app-role-role-${row.id}`}>Role</Label>
                  <select
                    id={`app-role-role-${row.id}`}
                    value={row.roleId}
                    onChange={(event) =>
                      handleRoleChange(row.id, event.target.value)
                    }
                    disabled={disabled || !selectedApp}
                    data-testid={`user-role-role-${row.id}`}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Select role</option>
                    {selectedApp?.roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.id)}
                    disabled={disabled}
                    data-testid={`remove-user-role-${row.id}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            disabled={disabled}
            data-testid="add-user-role-row"
          >
            <Plus className="size-4" />
            Add Role
          </Button>
        </div>
      )}
    </div>
  );
}
