"use client";

import { useState, useCallback } from "react";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";

interface UsePasskeyOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function usePasskey(options: UsePasskeyOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerPasskey = useCallback(
    async (name: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // Get registration options from server
        const optionsResponse = await fetch("/api/auth/passkey/register/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });

        if (!optionsResponse.ok) {
          const data = await optionsResponse.json();
          throw new Error(data.error || "Failed to get registration options");
        }

        const registrationOptions: PublicKeyCredentialCreationOptionsJSON =
          await optionsResponse.json();

        // Start registration with browser
        const credential = await startRegistration({ optionsJSON: registrationOptions });

        // Verify with server
        const verifyResponse = await fetch("/api/auth/passkey/register/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, credential }),
        });

        if (!verifyResponse.ok) {
          const data = await verifyResponse.json();
          throw new Error(data.error || "Failed to verify registration");
        }

        options.onSuccess?.();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Passkey registration failed";
        setError(message);
        options.onError?.(err instanceof Error ? err : new Error(message));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const authenticateWithPasskey = useCallback(
    async (email?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // Get authentication options from server
        const optionsResponse = await fetch(
          "/api/auth/passkey/authenticate/options",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          }
        );

        if (!optionsResponse.ok) {
          const data = await optionsResponse.json();
          throw new Error(data.error || "Failed to get authentication options");
        }

        const optionsData = await optionsResponse.json();
        const { sessionId, ...authenticationOptions } =
          optionsData as PublicKeyCredentialRequestOptionsJSON & { sessionId: string };

        // Start authentication with browser
        const credential = await startAuthentication({ optionsJSON: authenticationOptions });

        // Verify with server
        const verifyResponse = await fetch(
          "/api/auth/passkey/authenticate/verify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential, sessionId }),
          }
        );

        if (!verifyResponse.ok) {
          const data = await verifyResponse.json();
          throw new Error(data.error || "Failed to verify authentication");
        }

        options.onSuccess?.();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Passkey authentication failed";
        setError(message);
        options.onError?.(err instanceof Error ? err : new Error(message));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  return {
    isLoading,
    error,
    registerPasskey,
    authenticateWithPasskey,
    clearError: () => setError(null),
  };
}
