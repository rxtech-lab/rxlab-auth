"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Plus, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createOAuthClient } from "@/actions/admin/clients/create";
import { updateOAuthClient } from "@/actions/admin/clients/update";
import {
  SCOPE_RESOURCES,
  SPECIAL_SCOPES,
  OPERATIONS,
  getScopesByResource,
} from "@/lib/scopes";

interface ClientFormProps {
  client?: {
    id: string;
    name: string;
    description: string | null;
    redirectUris: string[];
    allowedScopes: string[];
    isFirstParty: boolean;
    clientType?: "public" | "confidential";
  };
}

export function ClientForm({ client }: ClientFormProps) {
  const router = useRouter();
  const isEditing = !!client;

  const [name, setName] = useState(client?.name || "");
  const [description, setDescription] = useState(client?.description || "");
  const [redirectUris, setRedirectUris] = useState<string[]>(
    client?.redirectUris || [""]
  );
  const [allowedScopes, setAllowedScopes] = useState<string[]>(
    client?.allowedScopes || ["openid"]
  );
  const [isFirstParty, setIsFirstParty] = useState(client?.isFirstParty || false);
  const [clientType, setClientType] = useState<"public" | "confidential">(
    client?.clientType || "confidential"
  );
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    clientId: string;
    clientSecret?: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAddRedirectUri = () => {
    setRedirectUris([...redirectUris, ""]);
  };

  const handleRemoveRedirectUri = (index: number) => {
    setRedirectUris(redirectUris.filter((_, i) => i !== index));
  };

  const handleRedirectUriChange = (index: number, value: string) => {
    const newUris = [...redirectUris];
    newUris[index] = value;
    setRedirectUris(newUris);
  };

  const handleScopeToggle = (scope: string) => {
    if (allowedScopes.includes(scope)) {
      if (scope === "openid") return; // openid is required
      setAllowedScopes(allowedScopes.filter((s) => s !== scope));
    } else {
      setAllowedScopes([...allowedScopes, scope]);
    }
  };

  const handleResourceToggle = (resourceKey: string) => {
    const resourceScopes = getScopesByResource(resourceKey);
    const scopeKeys = resourceScopes.map((s) => s.key);
    const allSelected = scopeKeys.every((key) => allowedScopes.includes(key));

    if (allSelected) {
      // Deselect all scopes for this resource
      setAllowedScopes(allowedScopes.filter((s) => !scopeKeys.includes(s)));
    } else {
      // Select all scopes for this resource
      const newScopes = new Set([...allowedScopes, ...scopeKeys]);
      setAllowedScopes(Array.from(newScopes));
    }
  };

  const isResourceFullySelected = (resourceKey: string) => {
    const resourceScopes = getScopesByResource(resourceKey);
    return resourceScopes.every((s) => allowedScopes.includes(s.key));
  };

  const isResourcePartiallySelected = (resourceKey: string) => {
    const resourceScopes = getScopesByResource(resourceKey);
    const selectedCount = resourceScopes.filter((s) =>
      allowedScopes.includes(s.key)
    ).length;
    return selectedCount > 0 && selectedCount < resourceScopes.length;
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validUris = redirectUris.filter((uri) => uri.trim());
    if (validUris.length === 0) {
      setError("At least one redirect URI is required");
      return;
    }

    startTransition(async () => {
      if (isEditing) {
        const result = await updateOAuthClient(client.id, {
          name,
          description: description || undefined,
          redirectUris: validUris,
          allowedScopes: allowedScopes as ("openid" | "profile" | "email" | "offline_access")[],
          isFirstParty,
        });
        if (result.success) {
          router.push("/admin/dashboard/clients");
        } else {
          setError(result.error || "Failed to update client");
        }
      } else {
        const result = await createOAuthClient({
          name,
          description: description || undefined,
          redirectUris: validUris,
          allowedScopes: allowedScopes as ("openid" | "profile" | "email" | "offline_access")[],
          isFirstParty,
          clientType,
          signInPermission: "all",
        });
        if (result.success && result.clientId) {
          setCredentials({
            clientId: result.clientId,
            clientSecret: result.clientSecret,
          });
        } else {
          setError(result.error || "Failed to create client");
        }
      }
    });
  };

  if (credentials) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {clientType === "public" ? (
          <div className="bg-primary/8 rounded-xl p-4">
            <h3 className="font-semibold text-primary mb-2">
              Public Client Created!
            </h3>
            <p className="text-sm text-primary/80 mb-2">
              This is a public client. No client secret is generated.
            </p>
            <p className="text-sm text-primary/80">
              You must use PKCE (Proof Key for Code Exchange) for authorization code flow.
            </p>
          </div>
        ) : (
          <div className="bg-green-500/10 rounded-xl p-4">
            <h3 className="font-semibold text-green-600 dark:text-green-400 mb-2">
              Client Created Successfully!
            </h3>
            <p className="text-sm text-green-600/80 dark:text-green-400/80 mb-4">
              Save these credentials now. The client secret will not be shown again.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client ID</Label>
            <div className="flex gap-2">
              <Input data-testid="client-id-display" value={credentials.clientId} readOnly className="font-mono" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopy(credentials.clientId, "id")}
              >
                {copied === "id" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {clientType === "confidential" && credentials.clientSecret && (
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <div className="flex gap-2">
                <Input
                  data-testid="client-secret-display"
                  value={credentials.clientSecret}
                  readOnly
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(credentials.clientSecret!, "secret")}
                >
                  {copied === "secret" ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <Button data-testid="done-button" onClick={() => router.push("/admin/dashboard/clients")}>
          Done
        </Button>
      </motion.div>
    );
  }

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

      <div className="space-y-2">
        <Label htmlFor="name">Application Name *</Label>
        <Input
          id="name"
          data-testid="client-name"
          placeholder="My Application"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          data-testid="client-description"
          placeholder="A brief description of your application"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label>Client Type *</Label>
        <p className="text-xs text-muted-foreground">
          Choose the type of OAuth client based on your application
        </p>
        <div className="flex flex-col gap-3 mt-2">
          <label className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
            <input
              type="radio"
              name="clientType"
              data-testid="client-type-confidential"
              value="confidential"
              checked={clientType === "confidential"}
              onChange={(e) => setClientType(e.target.value as "confidential")}
              disabled={isPending || isEditing}
              className="mt-1"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">Confidential Client</span>
              <p className="text-xs text-muted-foreground">
                Server-side apps that can securely store secrets (requires client_secret)
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
            <input
              type="radio"
              name="clientType"
              data-testid="client-type-public"
              value="public"
              checked={clientType === "public"}
              onChange={(e) => setClientType(e.target.value as "public")}
              disabled={isPending || isEditing}
              className="mt-1"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">Public Client</span>
              <p className="text-xs text-muted-foreground">
                SPAs, mobile apps that cannot securely store secrets (uses PKCE only)
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Redirect URIs *</Label>
        <p className="text-xs text-muted-foreground">
          URIs where users will be redirected after authorization. Supports * wildcards (e.g. https://*.example.com/callback)
        </p>
        <div className="space-y-2">
          {redirectUris.map((uri, index) => (
            <div key={index} className="flex gap-2">
              <Input
                data-testid={`redirect-uri-${index}`}
                placeholder="https://*.example.com/callback"
                value={uri}
                onChange={(e) => handleRedirectUriChange(index, e.target.value)}
                disabled={isPending}
              />
              {redirectUris.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-testid={`remove-redirect-uri-${index}`}
                  onClick={() => handleRemoveRedirectUri(index)}
                  disabled={isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="add-redirect-uri"
            onClick={handleAddRedirectUri}
            disabled={isPending}
          >
            <Plus className="size-4" />
            Add URI
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Allowed Scopes *</Label>
        <p className="text-xs text-muted-foreground">
          Scopes this application can request
        </p>
        <div className="space-y-3">
          {/* Special Scopes (openid, offline_access) */}
          {SPECIAL_SCOPES.map((scope) => {
            const isSelected = allowedScopes.includes(scope.key);
            const isRequired = scope.required;
            return (
              <button
                key={scope.key}
                data-testid={scope.key}
                type="button"
                onClick={() => handleScopeToggle(scope.key)}
                disabled={isPending || isRequired}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                } ${isPending || isRequired ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <scope.icon className="w-5 h-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{scope.title}</span>
                    {isRequired && (
                      <span className="text-xs text-muted-foreground">(Required)</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{scope.subtitle}</p>
                </div>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? "bg-primary border-primary" : "border-border"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
              </button>
            );
          })}

          {/* Resource Scopes (grouped by resource) */}
          {SCOPE_RESOURCES.map((resource) => {
            const resourceScopes = getScopesByResource(resource.key);
            const isFullySelected = isResourceFullySelected(resource.key);
            const isPartiallySelected = isResourcePartiallySelected(resource.key);

            return (
              <div key={resource.key} className="rounded-xl border border-border">
                {/* Resource Header */}
                <button
                  data-testid={resource.key}
                  type="button"
                  onClick={() => handleResourceToggle(resource.key)}
                  disabled={isPending}
                  className={`w-full flex items-start gap-3 p-3 text-left transition-colors rounded-t-xl ${
                    isFullySelected || isPartiallySelected
                      ? "bg-primary/5"
                      : "hover:bg-muted/50"
                  } ${isPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <resource.icon className="w-5 h-5 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{resource.title}</span>
                    <p className="text-xs text-muted-foreground">{resource.subtitle}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isFullySelected
                        ? "bg-primary border-primary"
                        : isPartiallySelected
                          ? "bg-primary/50 border-primary"
                          : "border-border"
                    }`}
                  >
                    {(isFullySelected || isPartiallySelected) && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                </button>

                {/* Operation Checkboxes */}
                <div className="border-t border-border bg-muted/30 rounded-b-xl">
                  {resourceScopes.map((scope) => {
                    const isSelected = allowedScopes.includes(scope.key);
                    const op = OPERATIONS[scope.operation!];
                    const OpIcon = op.icon;

                    return (
                      <button
                        key={scope.key}
                        data-testid={scope.key}
                        type="button"
                        onClick={() => handleScopeToggle(scope.key)}
                        disabled={isPending}
                        className={`w-full flex items-center gap-3 px-3 py-2 pl-11 text-left transition-colors last:rounded-b-xl ${
                          isSelected ? "bg-primary/5" : "hover:bg-muted/50"
                        } ${isPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <OpIcon className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1">
                          <span className="text-sm">{op.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {scope.subtitle}
                          </span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? "bg-primary border-primary" : "border-border"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isFirstParty"
          data-testid="first-party-checkbox"
          checked={isFirstParty}
          onChange={(e) => setIsFirstParty(e.target.checked)}
          disabled={isPending}
          className="rounded"
        />
        <Label htmlFor="isFirstParty" className="text-sm font-normal">
          First-party application (skip consent screen)
        </Label>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          data-testid="cancel-button"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" data-testid="submit-button" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {isEditing ? "Saving..." : "Creating..."}
            </>
          ) : isEditing ? (
            "Save Changes"
          ) : (
            "Create Application"
          )}
        </Button>
      </div>
    </form>
  );
}
