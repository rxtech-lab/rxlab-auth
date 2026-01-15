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
import { SUPPORTED_SCOPES } from "@/lib/validations/oauth";

interface ClientFormProps {
  client?: {
    id: string;
    name: string;
    description: string | null;
    redirectUris: string[];
    allowedScopes: string[];
    isFirstParty: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    clientId: string;
    clientSecret: string;
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
        });
        if (result.success && result.clientId && result.clientSecret) {
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
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
            Client Created Successfully!
          </h3>
          <p className="text-sm text-green-700 dark:text-green-300 mb-4">
            Save these credentials now. The client secret will not be shown again.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client ID</Label>
            <div className="flex gap-2">
              <Input value={credentials.clientId} readOnly className="font-mono" />
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

          <div className="space-y-2">
            <Label>Client Secret</Label>
            <div className="flex gap-2">
              <Input
                value={credentials.clientSecret}
                readOnly
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleCopy(credentials.clientSecret, "secret")}
              >
                {copied === "secret" ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <Button onClick={() => router.push("/admin/dashboard/clients")}>
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
          className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3"
        >
          {error}
        </motion.div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Application Name *</Label>
        <Input
          id="name"
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
          placeholder="A brief description of your application"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label>Redirect URIs *</Label>
        <p className="text-xs text-muted-foreground">
          URIs where users will be redirected after authorization
        </p>
        <div className="space-y-2">
          {redirectUris.map((uri, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="https://example.com/callback"
                value={uri}
                onChange={(e) => handleRedirectUriChange(index, e.target.value)}
                disabled={isPending}
              />
              {redirectUris.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
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
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_SCOPES.map((scope) => (
            <Button
              key={scope}
              type="button"
              variant={allowedScopes.includes(scope) ? "default" : "outline"}
              size="sm"
              onClick={() => handleScopeToggle(scope)}
              disabled={isPending || scope === "openid"}
            >
              {scope}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isFirstParty"
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
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
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
