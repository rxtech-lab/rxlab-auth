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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="rounded-2xl bg-destructive/10 p-5">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-destructive">Authorization Error</h1>
          <p className="text-muted-foreground text-[15px]">{errorDescription}</p>
          <p className="text-sm text-muted-foreground">
            Error code: <code className="bg-muted px-2 py-1 rounded-lg text-xs">{error}</code>
          </p>
        </div>
        <BackButton />
      </div>
    </div>
  );
}
