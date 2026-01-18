"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface OAuthEndpointsCardProps {
  endpoints: {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    discoveryUrl: string;
  };
}

export function OAuthEndpointsCard({ endpoints }: OAuthEndpointsCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const urlFields = [
    { key: "issuer", label: "Issuer URL", value: endpoints.issuer },
    {
      key: "authorization",
      label: "Authorization Endpoint",
      value: endpoints.authorizationEndpoint,
    },
    { key: "token", label: "Token Endpoint", value: endpoints.tokenEndpoint },
    { key: "discovery", label: "Discovery URL", value: endpoints.discoveryUrl },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>OAuth Server Endpoints</CardTitle>
        <CardDescription>
          Use these URLs to configure your OAuth client application
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {urlFields.map(({ key, label, value }) => (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <div className="flex gap-2">
              <Input
                data-testid={`oauth-endpoint-${key}`}
                value={value}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-testid={`copy-${key}`}
                onClick={() => handleCopy(value, key)}
              >
                {copied === key ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          For automatic configuration, most OAuth libraries can use the
          Discovery URL.
        </p>
      </CardContent>
    </Card>
  );
}
