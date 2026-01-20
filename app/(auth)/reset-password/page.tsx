import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { validateResetToken, expireToken } from "@/actions/auth/reset-password";
import {
  RequestResetForm,
  ResetSentConfirmation,
  TokenExpiredError,
  NewPasswordForm,
} from "@/components/auth/reset-password";

export const metadata = {
  title: "Reset Password - RxLab Auth",
  description: "Reset your password",
};

function ResetPasswordFormFallback() {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

async function ResetPasswordContent({
  token,
  sent,
}: {
  token?: string;
  sent: boolean;
}) {
  // Case 1: Email sent confirmation (after successful request)
  if (sent && !token) {
    return <ResetSentConfirmation />;
  }

  // Case 2: No token - show request form
  if (!token) {
    return <RequestResetForm />;
  }

  // Case 3: Token present - validate server-side
  const validation = await validateResetToken(token);

  if (!validation.valid) {
    return <TokenExpiredError error={validation.error} />;
  }

  // Mark token as used (single-use protection)
  await expireToken(token);

  // Case 4: Valid token - show password reset form
  return <NewPasswordForm token={token} />;
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; sent?: string }>;
}) {
  const { token, sent } = await searchParams;

  return (
    <Suspense fallback={<ResetPasswordFormFallback />}>
      <ResetPasswordContent token={token} sent={sent === "true"} />
    </Suspense>
  );
}
