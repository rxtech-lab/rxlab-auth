import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Loader2 } from "lucide-react";
import { getEnabledSocialProviders } from "@/lib/auth/social/providers";

export const metadata = {
  title: "Sign In - RxLab Auth",
  description: "Sign in to your account",
};

function LoginFormFallback() {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function LoginPage() {
  const socialProviders = getEnabledSocialProviders();

  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm socialProviders={socialProviders} />
    </Suspense>
  );
}
