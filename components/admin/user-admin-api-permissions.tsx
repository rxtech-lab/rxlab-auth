"use client";

import { KeyRound, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  READ_OAUTH_CLIENTS_PERMISSION,
  type ReadOAuthClientsPermissionSelection,
} from "@/lib/admin-api/permissions";

interface OAuthClientOption {
  id: string;
  name: string;
}

interface UserAdminApiPermissionsProps {
  clients: OAuthClientOption[];
  value: ReadOAuthClientsPermissionSelection;
  disabled?: boolean;
  onChange: (value: ReadOAuthClientsPermissionSelection) => void;
}

export function UserAdminApiPermissions({
  clients,
  value,
  disabled = false,
  onChange,
}: UserAdminApiPermissionsProps) {
  const setClientSelected = (clientId: string, selected: boolean) => {
    const clientIds = selected
      ? [...value.clientIds, clientId]
      : value.clientIds.filter((id) => id !== clientId);

    onChange({ ...value, clientIds: Array.from(new Set(clientIds)) });
  };

  const selectedClientNames = clients
    .filter((client) => value.clientIds.includes(client.id))
    .map((client) => client.name);

  return (
    <div className="space-y-4 border-t pt-4" data-testid="admin-api-permissions">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Admin API Permissions</h3>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="read-oauth-clients-permission">
              {READ_OAUTH_CLIENTS_PERMISSION.title}
            </Label>
            <p className="text-xs text-muted-foreground">
              {READ_OAUTH_CLIENTS_PERMISSION.description}
            </p>
            <code className="block text-xs text-muted-foreground">
              {READ_OAUTH_CLIENTS_PERMISSION.key}
            </code>
          </div>
          <Switch
            id="read-oauth-clients-permission"
            checked={value.enabled}
            onCheckedChange={(enabled) => onChange({ ...value, enabled })}
            disabled={disabled}
            data-testid="read-oauth-clients-toggle"
          />
        </div>

        {value.enabled && (
          <div className="space-y-3 border-t pt-3">
            <div className="space-y-2">
              <Label htmlFor="read-oauth-clients-scope">Client access</Label>
              <select
                id="read-oauth-clients-scope"
                value={value.scope}
                onChange={(event) =>
                  onChange({
                    ...value,
                    scope: event.target.value as "all" | "selected",
                  })
                }
                disabled={disabled}
                data-testid="read-oauth-clients-scope"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="all">All OAuth clients</option>
                <option value="selected">Selected OAuth clients</option>
              </select>
            </div>

            {value.scope === "selected" && (
              <div className="space-y-2">
                <Label>OAuth clients</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={disabled || clients.length === 0}
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                        data-testid="read-oauth-clients-picker"
                      >
                        <ListFilter className="size-4" />
                        {value.clientIds.length > 0
                          ? `${value.clientIds.length} selected`
                          : "Select OAuth clients"}
                      </Button>
                    }
                  />
                  <DropdownMenuContent className="min-w-64">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        Allowed OAuth clients
                      </DropdownMenuLabel>
                      {clients.map((client) => (
                        <DropdownMenuCheckboxItem
                          key={client.id}
                          checked={value.clientIds.includes(client.id)}
                          onCheckedChange={(checked) =>
                            setClientSelected(client.id, checked)
                          }
                          data-testid={`read-oauth-client-option-${client.id}`}
                        >
                          <span className="truncate">{client.name}</span>
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                {clients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No OAuth clients are available.
                  </p>
                ) : selectedClientNames.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedClientNames.join(", ")}
                  </p>
                ) : (
                  <p className="text-xs text-destructive">
                    Select at least one OAuth client.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
