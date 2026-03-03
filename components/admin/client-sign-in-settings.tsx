"use client";

import { useState } from "react";
import { SignInPermissionCard } from "@/components/admin/sign-in-permission-card";
import { ClientEmailWhitelistCard } from "@/components/admin/client-email-whitelist-card";
import type { OAuthClientEmailWhitelist } from "@/lib/db/schema";

interface ClientSignInSettingsProps {
  clientId: string;
  initialPermission: "all" | "none" | "whitelist";
  initialEmails: OAuthClientEmailWhitelist[];
}

export function ClientSignInSettings({
  clientId,
  initialPermission,
  initialEmails,
}: ClientSignInSettingsProps) {
  const [permission, setPermission] = useState<"all" | "none" | "whitelist">(
    initialPermission
  );

  return (
    <>
      <SignInPermissionCard
        clientId={clientId}
        initialPermission={permission}
        onPermissionChange={setPermission}
      />

      <ClientEmailWhitelistCard
        clientId={clientId}
        initialEmails={initialEmails}
        whitelistEnabled={permission === "whitelist"}
      />
    </>
  );
}
