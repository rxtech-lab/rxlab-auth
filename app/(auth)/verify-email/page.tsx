import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Verify Email - RxLab Auth",
  description: "Verify your email address",
};

function VerifyEmailFormFallback() {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFormFallback />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
