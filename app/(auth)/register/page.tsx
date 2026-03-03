import { Suspense } from "react";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Loader2, UserX } from "lucide-react";
import { getSignUpStatus } from "@/lib/settings/sign-up";

export const metadata = {
  title: "Create Account - RxLab Auth",
  description: "Create a new account",
};

function RegisterFormFallback() {
  return (
    <div className="flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function SignUpDisabled() {
  return (
    <div className="w-full max-w-sm space-y-8 text-center" data-testid="signup-disabled-message">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <UserX className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Sign-up is disabled
        </h1>
        <p className="text-muted-foreground text-[15px]">
          New account registration is currently not available. Please contact an
          administrator if you need access.
        </p>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

async function RegisterContent() {
  const status = await getSignUpStatus();

  if (status.isCompletelyDisabled) {
    return <SignUpDisabled />;
  }

  return <RegisterForm whitelistOnly={!status.publicSignUpEnabled} />;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFormFallback />}>
      <RegisterContent />
    </Suspense>
  );
}
