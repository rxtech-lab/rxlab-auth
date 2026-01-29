import { AlertCircle } from "lucide-react";
import { BackButton } from "./back-button";

interface PageProps {
  searchParams: Promise<{
    error?: string;
    error_description?: string;
  }>;
}

const errorMessages: Record<string, string> = {
  invalid_request: "The request is missing a required parameter or is malformed.",
  invalid_client: "The client identifier is invalid or not found.",
  invalid_redirect_uri: "The redirect URI does not match the registered URI.",
  unauthorized_client: "The client is not authorized to use this authorization method.",
  access_denied: "The resource owner denied the request.",
  unsupported_response_type: "The authorization server does not support this response type.",
  invalid_scope: "The requested scope is invalid or unknown.",
  server_error: "The authorization server encountered an unexpected error.",
};

export default async function OAuthErrorPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = params.error || "unknown_error";
  const errorDescription =
    params.error_description || errorMessages[error] || "An unexpected error occurred.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-destructive">Authorization Error</h1>
          <p className="text-muted-foreground">{errorDescription}</p>
          <p className="text-sm text-muted-foreground/70">
            Error code: <code className="bg-muted px-1.5 py-0.5 rounded">{error}</code>
          </p>
        </div>
        <BackButton />
      </div>
    </div>
  );
}
